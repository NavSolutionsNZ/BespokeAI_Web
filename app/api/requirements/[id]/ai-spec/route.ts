import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildSystemPrompt(bcVersion: string) {
  return `You are a senior Microsoft Dynamics 365 Business Central / Navision (NAV) expert with 20+ years of experience as both a functional consultant and a developer. You have deep hands-on knowledge of:
- BC/NAV object model: Tables, Pages, Codeunits, Reports, XMLports, Queries, Enums, Interfaces
- AL language development, extensions, AppSource publishing
- Business Central versions from NAV 2009 through BC SaaS (v15–25) and BC 14 on-premise
- Standard BC functional areas: Finance, Sales, Purchase, Inventory, Manufacturing, Projects, Service, Warehousing, HR, Fixed Assets
- Customisation patterns: approval workflows, custom fields, posting routines, integrations, report layouts, dimensions, posting groups, number series
- NZ/AU localisation: GST, PEPPOL e-invoicing, bank reconciliation, IRD requirements

The customer is running: **${bcVersion}**

Your job is to analyse a plain-English customisation request and:
1. Produce a professional functional specification with exact BC objects
2. State your assumptions explicitly
3. Ask targeted clarifying questions for anything that would materially change scope, objects touched, or approach

CRITICAL: When customer answers are provided (Q&A pairs), you MUST:
- Incorporate each answer directly into the spec — update bcObjects, acceptanceCriteria, and estimatedDays accordingly
- Remove or resolve any questions that have been answered
- Only keep questions that are still genuinely unanswered
- Reflect the specific detail from answers in the acceptance criteria (e.g. if they said "$5,000 threshold", that exact figure must appear)

Be specific to ${bcVersion}. Reference exact standard objects (Table 36, Page 42, Codeunit 80 etc). For older NAV versions reference C/AL; for BC14+ reference AL extensions.

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "userStory": "As a [specific role], I want [specific capability] so that [measurable business value].",
  "acceptanceCriteria": [
    "Given [context], when [action], then [specific measurable outcome with figures if provided].",
    "..."
  ],
  "bcObjects": [
    "Table 36 Sales Header — add field Approval_Status (Option: Open, Pending, Approved, Rejected)",
    "Page 42 Sales Order — surface Approval_Status, add FactBox showing approval history",
    "Codeunit 80 Sales-Post — intercept OnRun, block posting if status not Approved",
    "Report 205 Order Confirmation — add approval stamp to footer",
    "..."
  ],
  "complexity": "Simple",
  "estimatedDays": 3,
  "assumptions": [
    "Assuming no existing approval workflow engine is configured for this document type",
    "..."
  ],
  "questions": [
    "Only questions that are still genuinely unanswered after incorporating customer responses",
    "..."
  ],
  "notes": "Technical notes specific to ${bcVersion}. Include version-specific gotchas, recommended patterns, migration considerations."
}

Complexity: Simple (1–3d field/validation changes), Medium (4–10d workflows/reports/integrations), Complex (10+d major modules/deep posting/external systems)`
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  // BC version lookup
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
        BC15: 'BC 15 (on-premise, AL extensions)',
        BC20: 'BC 20', BC21: 'BC 21', BC22: 'BC 22',
        BC23: 'BC 23', BC24: 'BC 24', BC25: 'BC 25 (latest)',
        NAV2018: 'NAV 2018 (C/AL, on-premise)',
        NAV2017: 'NAV 2017 (C/AL, on-premise)',
        NAV2016: 'NAV 2016 (C/AL, on-premise)',
      }
      bcVersion = vMap[signup.bcVersion] ?? signup.bcVersion
    } else if (req_data.tenant.bcInstance) {
      bcVersion = `Business Central (instance: ${req_data.tenant.bcInstance})`
    }
  } catch { /* use default */ }

  // Read new customerAnswers from request body (structured Q&A JSON or plain text)
  let bodyAnswers = ''
  let bodyQA: Array<{q: string; a: string}> | null = null
  try {
    const body = await req.json()
    bodyAnswers = body.customerAnswers ?? ''
    bodyQA     = body.qaStructured ?? null   // [{q, a}] from per-question UI
  } catch { /* no body */ }

  // Merge with saved answers
  const savedAnswers = req_data.customerAnswers ?? ''
  // Prefer new body answers; fall back to saved
  const answersToUse = bodyAnswers || savedAnswers

  // Get previous spec's questions for Q&A formatting
  let prevQuestions: string[] = []
  try {
    if (req_data.aiSpec) {
      const prevSpec = JSON.parse(req_data.aiSpec)
      prevQuestions = prevSpec.questions ?? []
    }
  } catch { /* ignore */ }

  // Format Q&A section for the AI prompt
  let qaSection = ''
  if (bodyQA && bodyQA.length > 0) {
    // Structured per-question answers from UI
    qaSection = '\n--- Customer responses to clarifying questions ---\n' +
      bodyQA.map((pair, i) => `Q${i+1}: ${pair.q}\nA${i+1}: ${pair.a}`).join('\n\n')
  } else if (prevQuestions.length > 0 && answersToUse) {
    // Pair previous questions with the free-text answer blob
    const lines = answersToUse.split('\n').filter((l: string) => l.trim())
    qaSection = '\n--- Customer responses to clarifying questions ---\n' +
      prevQuestions.map((q, i) => {
        // Try to find numbered answer (1. or Q1: or just the Nth line)
        const numbered = lines.find((l: string) => l.match(new RegExp(`^(${i+1}[.):])|(Q${i+1}[.):])`, 'i')))
        const answer   = numbered ?? lines[i] ?? '(not answered)'
        const cleaned  = answer.replace(/^[\d]+[.):\s]+/, '').replace(/^Q[\d]+[.):\s]+/i, '').trim()
        return `Q${i+1}: ${q}\nA${i+1}: ${cleaned}`
      }).join('\n\n')
  } else if (answersToUse) {
    qaSection = `\n--- Additional context from customer ---\n${answersToUse}`
  }

  const prompt = [
    `BC Area: ${req_data.bcArea}`,
    `Priority: ${req_data.priority.replace(/_/g, ' ')}`,
    `Title: ${req_data.title}`,
    '',
    `Customer description:`,
    req_data.description,
    qaSection,
  ].filter(s => s !== undefined).join('\n')

  let spec: object
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt(bcVersion) },
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

  // Persist spec + answers
  // If structured QA was provided, store as JSON; otherwise store as-is
  const answersToSave = bodyQA
    ? JSON.stringify(bodyQA)   // [{q, a}] structure
    : answersToUse || undefined

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data: { aiSpec: JSON.stringify(spec), customerAnswers: answersToSave },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({ requirement: updated, spec })
}
