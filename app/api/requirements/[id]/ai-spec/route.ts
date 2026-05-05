import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MAX_GENS = 4  // 1 initial + 3 customer-driven refinements

function buildSystemPrompt(bcVersion: string, isRefinement: boolean) {
  const baseExpertise = `You are a senior Microsoft Dynamics 365 Business Central / Navision (NAV) expert with 20+ years of experience as both a functional consultant and a developer. You have deep hands-on knowledge of:
- BC/NAV object model: Tables, Pages, Codeunits, Reports, XMLports, Queries, Enums, Interfaces
- AL language development, extensions, AppSource publishing
- Business Central versions from NAV 2009 through BC SaaS (v15–25) and BC 14 on-premise
- Standard BC functional areas: Finance, Sales, Purchase, Inventory, Manufacturing, Projects, Service, Warehousing, HR, Fixed Assets
- Customisation patterns: approval workflows, custom fields, posting routines, integrations, report layouts, dimensions, posting groups, number series
- NZ/AU localisation: GST, PEPPOL e-invoicing, bank reconciliation, IRD requirements

The customer is running: **${bcVersion}**`

  const refinementInstructions = isRefinement ? `

REFINEMENT MODE: You are updating an existing functional spec based on the customer's specific requested changes. You MUST:
- Apply every change the customer explicitly requested — do not ignore or soften their edits
- Carry forward ALL context from the previous spec (objects, criteria, assumptions) unless specifically overridden by the changes
- Update bcObjects, acceptanceCriteria, estimatedDays, and complexity to reflect the changes
- If the customer edited the user story or acceptance criteria directly, use their wording as the authoritative version
- Reduce the questions list — only ask about things genuinely still unclear after the changes
- Note in assumptions what changed from the previous version` : `

INITIAL SPEC MODE: Analyse the plain-English customisation request and:
1. Produce a professional functional specification with exact BC objects
2. State your assumptions explicitly  
3. Ask targeted clarifying questions for anything that would materially change scope`

  return `${baseExpertise}${refinementInstructions}

Be specific to ${bcVersion}. Reference exact standard objects (Table 36, Page 42, Codeunit 80 etc). For older NAV versions reference C/AL; for BC14+ reference AL extensions.

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "userStory": "As a [specific role], I want [specific capability] so that [measurable business value].",
  "acceptanceCriteria": [
    "Given [context], when [action], then [specific measurable outcome with figures if provided].",
    "..."
  ],
  "bcObjects": [
    "Table 36 Sales Header — add field 50100 Approval_Status (Option: Open,Pending,Approved,Rejected)",
    "..."
  ],
  "complexity": "Simple",
  "estimatedDays": 3,
  "assumptions": [
    "What was assumed (or what changed from previous version)",
    "..."
  ],
  "questions": [
    "Only questions still genuinely unanswered after all context",
    "..."
  ],
  "notes": "Technical notes specific to ${bcVersion}. Version-specific gotchas, recommended patterns."
}

Rules:
- Generate 3–6 acceptance criteria (Given/When/Then)
- assumptions: include what changed from previous spec if this is a refinement
- questions: only what is genuinely still unclear — aim to reduce these with each refinement
- Complexity: Simple (1–3d), Medium (4–10d), Complex (10+d)`
}

// POST /api/requirements/[id]/ai-spec
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

  // ── BC version lookup ────────────────────────────────────────────────────
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

  // ── Parse request body ───────────────────────────────────────────────────
  let bodyQA: Array<{q: string; a: string}> | null = null
  let customerRefinements = ''   // free-text changes the customer wants made
  let editedUserStory    = ''   // if customer directly edited the user story
  let editedCriteria: string[] = []  // if customer edited acceptance criteria

  try {
    const body = await req.json()
    bodyQA              = body.qaStructured ?? null
    customerRefinements = body.customerRefinements ?? ''
    editedUserStory     = body.editedUserStory ?? ''
    editedCriteria      = body.editedCriteria ?? []
  } catch { /* no body */ }

  // ── Read previous spec state ─────────────────────────────────────────────
  let prevGenCount = 0
  let prevSpec: any = null
  let prevQuestions: string[] = []
  let prevHistory: string[] = []  // accumulated refinement history

  try {
    if (req_data.aiSpec) {
      prevSpec      = JSON.parse(req_data.aiSpec)
      prevGenCount  = prevSpec._genCount ?? 0
      prevQuestions = prevSpec.questions ?? []
      prevHistory   = prevSpec._refinementHistory ?? []
    }
  } catch { /* ignore */ }

  // ── Enforce generation cap (non-superadmin only) ─────────────────────────
  if (user.role !== 'superadmin' && prevGenCount >= MAX_GENS) {
    return NextResponse.json({
      error: `You have used all ${MAX_GENS} spec generations for this requirement. Please submit your current spec, or contact BespoxAI if further changes are needed.`,
      limitReached: true,
      genCount: prevGenCount,
    }, { status: 429 })
  }

  const isRefinement = prevGenCount > 0

  // ── Build prompt sections ────────────────────────────────────────────────

  // Q&A section
  let qaSection = ''
  if (bodyQA && bodyQA.length > 0) {
    qaSection = '\n--- Customer responses to clarifying questions ---\n' +
      bodyQA.map((pair, i) => `Q${i+1}: ${pair.q}\nA${i+1}: ${pair.a}`).join('\n\n')
  } else if (prevQuestions.length > 0 && req_data.customerAnswers) {
    const saved = req_data.customerAnswers
    try {
      const qa = JSON.parse(saved)
      if (Array.isArray(qa) && qa[0]?.q) {
        qaSection = '\n--- Previous Q&A on record ---\n' +
          qa.map((p: any, i: number) => `Q${i+1}: ${p.q}\nA${i+1}: ${p.a}`).join('\n\n')
      } else {
        qaSection = `\n--- Previous context on record ---\n${saved}`
      }
    } catch {
      qaSection = `\n--- Previous context on record ---\n${saved}`
    }
  }

  // Customer refinements for this regeneration
  let refinementSection = ''
  if (isRefinement) {
    const parts: string[] = []

    if (customerRefinements.trim()) {
      parts.push(`Customer's requested changes:\n${customerRefinements.trim()}`)
    }
    if (editedUserStory.trim()) {
      parts.push(`Customer's edited user story (use this verbatim):\n"${editedUserStory.trim()}"`)
    }
    if (editedCriteria.length > 0) {
      parts.push(`Customer's edited acceptance criteria (use these as the base, then refine):\n${editedCriteria.map((c, i) => `${i+1}. ${c}`).join('\n')}`)
    }

    if (parts.length > 0) {
      refinementSection = '\n--- CUSTOMER REFINEMENTS FOR THIS REGENERATION ---\n' + parts.join('\n\n')
    }

    // Previous spec as context
    if (prevSpec) {
      refinementSection += `\n\n--- PREVIOUS SPEC (to be refined, not replaced wholesale) ---
User Story: ${prevSpec.userStory ?? ''}
Acceptance Criteria:
${(prevSpec.acceptanceCriteria ?? []).map((c: string, i: number) => `${i+1}. ${c}`).join('\n')}
BC Objects: ${(prevSpec.bcObjects ?? []).join(', ')}
Complexity: ${prevSpec.complexity ?? ''} (~${prevSpec.estimatedDays ?? '?'} days)
Notes: ${prevSpec.notes ?? ''}`
    }

    // Full refinement history for accumulated context
    if (prevHistory.length > 0) {
      refinementSection += '\n\n--- PREVIOUS REFINEMENT HISTORY (context only) ---\n' +
        prevHistory.map((h, i) => `Refinement ${i+1}: ${h}`).join('\n')
    }
  }

  const prompt = [
    `BC Area: ${req_data.bcArea}`,
    `Priority: ${req_data.priority.replace(/_/g, ' ')}`,
    `Title: ${req_data.title}`,
    '',
    'Original customer description:',
    req_data.description,
    qaSection,
    refinementSection,
  ].filter(Boolean).join('\n')

  // ── Call AI ──────────────────────────────────────────────────────────────
  let spec: any
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt(bcVersion, isRefinement) },
        { role: 'user',   content: prompt },
      ],
    })
    const raw     = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
    spec = JSON.parse(cleaned)
  } catch (err) {
    console.error('AI spec generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 })
  }

  // ── Accumulate refinement history ────────────────────────────────────────
  const newHistoryEntry = customerRefinements.trim()
    || (bodyQA ? `Answered ${bodyQA.length} clarifying questions` : '')
    || (editedUserStory ? 'Edited user story directly' : '')
    || 'Regenerated'

  const newHistory = isRefinement
    ? [...prevHistory, newHistoryEntry].slice(-6)  // keep last 6
    : []

  // ── Save ─────────────────────────────────────────────────────────────────
  const specWithMeta = {
    ...spec,
    _genCount: prevGenCount + 1,
    _refinementHistory: newHistory,
  }

  // Save Q&A if provided
  const answersToSave = bodyQA
    ? JSON.stringify(bodyQA)
    : (req_data.customerAnswers || undefined)

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data: { aiSpec: JSON.stringify(specWithMeta), customerAnswers: answersToSave },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({
    requirement: updated,
    spec: specWithMeta,
    genCount: prevGenCount + 1,
    maxGens: MAX_GENS,
    isRefinement,
  })
}
