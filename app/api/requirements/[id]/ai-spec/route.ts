import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic   = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MAX_GENS = 4  // 1 initial + 3 customer-driven refinements

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(bcVersion: string) {
  return `You are a senior Microsoft Dynamics 365 Business Central / Navision (NAV) expert with 20+ years of experience as both a functional consultant and a developer. You have deep hands-on knowledge of:
- BC/NAV object model: Tables, Pages, Codeunits, Reports, XMLports, Queries, Enums, Interfaces
- AL language development, extensions, AppSource publishing
- Business Central versions from NAV 2009 through BC SaaS (v15–25) and BC 14 on-premise
- Standard BC functional areas: Finance, Sales, Purchase, Inventory, Manufacturing, Projects, Service, Warehousing, HR, Fixed Assets
- Customisation patterns: approval workflows, custom fields, posting routines, integrations, report layouts, dimensions, posting groups, number series
- NZ/AU localisation: GST, PEPPOL e-invoicing, bank reconciliation, IRD requirements

The customer is running: **${bcVersion}**

SPEC GENERATION RULES:
You are producing a COMPLETE, AUTHORITATIVE functional specification. This is always a FULL REWRITE — not a patch of a previous version.

You will be given all available context: the original description, every round of Q&A, admin/consultant questions and answers, and any customer-requested changes. Your job is to synthesise ALL of this into a single, coherent, up-to-date specification that reflects the current understanding of the requirement.

Do NOT reference previous versions or say "as before". The output must stand alone as the definitive spec.

For the _changeSummary field: briefly describe what is new or different in this version compared to what was originally described (e.g. "Added prerelease customer flag after admin Q&A. Extended validation to quotes and invoices."). For the initial generation, set this to "Initial specification".

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "userStory": "As a [specific role], I want [specific capability] so that [measurable business value].",
  "acceptanceCriteria": [
    "Given [context], when [action], then [specific measurable outcome].",
    "..."
  ],
  "bcObjects": [
    "Table 36 Sales Header — add field 50100 Approval_Status (Option: Open,Pending,Approved,Rejected)",
    "..."
  ],
  "complexity": "Simple",
  "estimatedDays": 3,
  "assumptions": [
    "Explicit assumption about scope or behaviour",
    "..."
  ],
  "questions": [
    "Only questions genuinely still unanswered after ALL context provided",
    "..."
  ],
  "notes": "Technical notes specific to ${bcVersion}. Version-specific gotchas, recommended patterns.",
  "_changeSummary": "What is new or different in this version"
}

Rules:
- Generate 3–6 acceptance criteria (Given/When/Then format)
- Reduce questions with each generation — only include what is genuinely still unclear
- Complexity: Simple (1–3d), Medium (4–10d), Complex (10+d)
- Be specific to ${bcVersion} — reference exact standard objects (Table 36, Page 42, Codeunit 80 etc)
- For NAV versions reference C/AL; for BC14+ reference AL extensions`
}

// ── JSON repair ───────────────────────────────────────────────────────────────

function repairJSON(raw: string): string {
  let s = raw.trim().replace(/,\s*$/, '')
  const stack: string[] = []
  let inString = false
  let escape   = false
  for (const ch of s) {
    if (escape)        { escape = false; continue }
    if (ch === '\\')   { escape = true; continue }
    if (ch === '"')    { inString = !inString; continue }
    if (inString)      continue
    if (ch === '{')    stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  if (inString) s += '"'
  return s + stack.reverse().join('')
}

// ── POST /api/requirements/[id]/ai-spec ──────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

  const req_data = await (prisma as any).requirement.findUnique({
    where: { id: params.id },
    include: { tenant: { select: { bcInstance: true, name: true } } },
  })
  if (!req_data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'superadmin' && req_data.tenantId !== user.tenantId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── BC version ────────────────────────────────────────────────────────────
  let bcVersion = 'Business Central (version not specified)'
  try {
    const signup = await (prisma as any).signupRequest.findFirst({
      where: { companyName: { contains: req_data.tenant.name.split(' ')[0] } },
      orderBy: { createdAt: 'desc' },
      select: { bcVersion: true },
    })
    if (signup?.bcVersion) {
      const vMap: Record<string, string> = {
        BC14: 'BC 14 (on-premise, C/AL + AL hybrid)',
        BC15: 'BC 15 (AL extensions)',
        BC20: 'BC 20', BC21: 'BC 21', BC22: 'BC 22',
        BC23: 'BC 23', BC24: 'BC 24', BC25: 'BC 25 (latest)',
        NAV2018: 'NAV 2018 (C/AL)', NAV2017: 'NAV 2017 (C/AL)', NAV2016: 'NAV 2016 (C/AL)',
      }
      bcVersion = vMap[signup.bcVersion] ?? signup.bcVersion
    } else if (req_data.tenant.bcInstance) {
      bcVersion = `Business Central (instance: ${req_data.tenant.bcInstance})`
    }
  } catch { /* use default */ }

  // ── Parse request body ────────────────────────────────────────────────────
  let bodyQA: Array<{q: string; a: string}> | null = null
  let customerRefinements = ''
  let editedUserStory     = ''
  let editedCriteria: string[] = []

  try {
    const body          = await req.json()
    bodyQA              = body.qaStructured ?? null
    customerRefinements = body.customerRefinements ?? ''
    editedUserStory     = body.editedUserStory ?? ''
    editedCriteria      = body.editedCriteria ?? []
  } catch { /* no body */ }

  // ── Read previous spec ────────────────────────────────────────────────────
  let prevGenCount = 0
  let prevSpec: any = null
  let prevHistory: Array<{ at: string; trigger: string; summary: string; snapshot: any }> = []

  try {
    if (req_data.aiSpec) {
      prevSpec     = JSON.parse(req_data.aiSpec)
      prevGenCount = prevSpec._genCount ?? 0
      prevHistory  = prevSpec._history  ?? []
    }
  } catch { /* ignore */ }

  // ── Generation cap ────────────────────────────────────────────────────────
  if (user.role !== 'superadmin' && prevGenCount >= MAX_GENS) {
    return NextResponse.json({
      error: `You have used all ${MAX_GENS} spec generations for this requirement. Please submit your current spec, or contact BespoxAI if further changes are needed.`,
      limitReached: true,
      genCount: prevGenCount,
    }, { status: 429 })
  }

  const isRefinement = prevGenCount > 0

  // ── Build context sections ────────────────────────────────────────────────

  // 1. AI clarifying Q&A answers (from current request or saved)
  let aiQASection = ''
  const qaToUse = bodyQA ?? (() => {
    try {
      const saved = req_data.customerAnswers ? JSON.parse(req_data.customerAnswers) : null
      return Array.isArray(saved) && saved[0]?.q ? saved : null
    } catch { return null }
  })()
  if (qaToUse && qaToUse.length > 0) {
    aiQASection = '\n--- Customer answers to AI clarifying questions ---\n' +
      qaToUse.map((p: any, i: number) => `Q${i+1}: ${p.q}\nA${i+1}: ${p.a}`).join('\n\n')
  }

  // 2. All admin/consultant Q&A rounds (full log — every round, answered or not)
  let adminQASection = ''
  try {
    const qaLog = req_data.adminQALog ? JSON.parse(req_data.adminQALog) : []
    if (qaLog.length > 0) {
      adminQASection = '\n--- Consultant/admin Q&A rounds (all rounds) ---\n' +
        qaLog.map((r: any) => [
          `Round ${r.round} — asked ${new Date(r.askedAt).toLocaleDateString()}:`,
          `Consultant questions:\n${r.questions}`,
          r.answers
            ? `Customer answers:\n${r.answers}`
            : `(awaiting customer response)`,
        ].join('\n')).join('\n\n')
    }
  } catch { /* ignore */ }

  // 3. Customer-requested changes for this regeneration
  let changesSection = ''
  if (isRefinement) {
    const parts: string[] = []
    if (customerRefinements.trim())
      parts.push(`Customer's requested changes:\n${customerRefinements.trim()}`)
    if (editedUserStory.trim())
      parts.push(`Customer's edited user story (use verbatim):\n"${editedUserStory.trim()}"`)
    if (editedCriteria.length > 0)
      parts.push(`Customer's edited acceptance criteria (use as base):\n${editedCriteria.map((c, i) => `${i+1}. ${c}`).join('\n')}`)
    if (parts.length > 0)
      changesSection = '\n--- Changes requested for this regeneration ---\n' + parts.join('\n\n')
  }

  // 4. Previous history summaries (context only — no full snapshots in prompt)
  let historySection = ''
  if (prevHistory.length > 0) {
    historySection = '\n--- Spec version history (context only) ---\n' +
      prevHistory.map((h, i) => `v${i+1} (${new Date(h.at).toLocaleDateString()}): ${h.summary}`).join('\n')
  }

  const prompt = [
    `BC Area: ${req_data.bcArea}`,
    `Priority: ${req_data.priority.replace(/_/g, ' ')}`,
    `Title: ${req_data.title}`,
    '',
    'Original customer description:',
    req_data.description,
    aiQASection,
    adminQASection,
    changesSection,
    historySection,
  ].filter(Boolean).join('\n')

  // ── Call AI ───────────────────────────────────────────────────────────────
  let spec: any
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: buildSystemPrompt(bcVersion) },
        { role: 'user',   content: prompt },
      ],
    })
    const raw     = completion.choices[0]?.message?.content ?? ''
    if (!raw) throw new Error('Empty response from AI')
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
    let parsed: any = null
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      try { parsed = JSON.parse(repairJSON(cleaned)) } catch {
        throw new Error('AI returned malformed JSON. Please try again.')
      }
    }
    spec = parsed
  } catch (err: any) {
    console.error('AI spec generation failed:', err)
    return NextResponse.json({ error: err.message ?? 'AI generation failed. Please try again.' }, { status: 500 })
  }

  // ── Build history entry (snapshot of previous spec before overwriting) ────
  const triggerDescription = (() => {
    if (bodyQA && bodyQA.length > 0)      return `Customer answered ${bodyQA.length} clarifying question${bodyQA.length > 1 ? 's' : ''}`
    if (customerRefinements.trim())        return `Customer refinement: ${customerRefinements.trim().slice(0, 80)}`
    if (editedUserStory.trim())            return 'Customer edited user story directly'
    if (editedCriteria.length > 0)        return 'Customer edited acceptance criteria directly'
    if (adminQASection)                    return 'Regenerated after consultant Q&A'
    return 'Regenerated'
  })()

  const newHistory = isRefinement && prevSpec
    ? [
        ...prevHistory,
        {
          at:       new Date().toISOString(),
          trigger:  triggerDescription,
          summary:  prevSpec._changeSummary ?? `Version ${prevGenCount}`,
          snapshot: (({ _genCount, _history, ...rest }) => rest)(prevSpec),
        },
      ].slice(-5)  // keep last 5 snapshots
    : []

  // ── Save ──────────────────────────────────────────────────────────────────
  const specWithMeta = {
    ...spec,
    _genCount: prevGenCount + 1,
    _history:  newHistory,
  }

  const answersToSave = bodyQA
    ? JSON.stringify(bodyQA)
    : (req_data.customerAnswers || undefined)

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data:  { aiSpec: JSON.stringify(specWithMeta), customerAnswers: answersToSave },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({
    requirement: updated,
    spec:        specWithMeta,
    genCount:    prevGenCount + 1,
    maxGens:     MAX_GENS,
    isRefinement,
  })
}
