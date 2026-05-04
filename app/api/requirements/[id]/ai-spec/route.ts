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
- AL language development, extensions, and AppSource publishing
- Business Central versions from NAV 2009 through BC 14 (on-premise) and BC SaaS (v15–25)
- Standard BC functional areas: Finance, Sales, Purchase, Inventory, Manufacturing, Projects, Service, Warehousing, HR, Fixed Assets
- Common customisation patterns: approval workflows, custom fields, modified posting routines, integrations, report layouts, number series, dimensions, posting groups
- NZ/AU localisation: GST, PEPPOL e-invoicing, bank reconciliation, IRD requirements

The customer is running: **${bcVersion}**

Your job is to analyse a plain-English customisation request and produce a professional functional specification — AND to surface your assumptions and ask targeted clarifying questions so the spec can be refined before development begins.

Be specific to the BC version. Reference the exact standard objects that would be modified or extended. Flag anything that behaves differently across versions. If the version is older NAV, reference C/AL objects; if BC14+ on-premise or SaaS, reference AL extensions.

Respond ONLY with a valid JSON object — no markdown, no preamble. Use this exact shape:
{
  "userStory": "As a [specific role], I want [specific capability] so that [measurable business value].",
  "acceptanceCriteria": [
    "Given [context], when [action], then [specific measurable outcome].",
    "..."
  ],
  "bcObjects": [
    "Table 36 Sales Header — add field Approval_Status (Option: Open, Pending, Approved, Rejected)",
    "Page 42 Sales Order — surface new field, add FactBox showing approval history",
    "Codeunit 80 Sales-Post — intercept OnRun, block posting if status not Approved",
    "..."
  ],
  "complexity": "Simple",
  "estimatedDays": 3,
  "assumptions": [
    "Assuming no existing approval workflow engine is configured for this document type",
    "..."
  ],
  "questions": [
    "Should approval be required on all sales orders, or only above a certain dollar threshold?",
    "Who are the approvers — specific named users, or a BC permission group / approval chain?",
    "..."
  ],
  "notes": "Technical notes specific to ${bcVersion}. Include known limitations, version-specific gotchas, or recommended implementation patterns."
}

Rules:
- Generate 3–6 acceptance criteria (Given/When/Then format)
- Generate 2–5 assumptions (state what you assumed to write the spec)
- Generate 3–6 clarifying questions — focus on unknowns that would materially change scope, approach, or objects touched
- If customerAnswers are provided, incorporate them to make the spec more precise and reduce unanswered questions accordingly
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

  if (user.role !== 'superadmin' && req_data.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Try to get BC version from signup request for this tenant
  let bcVersion = 'Business Central (version not specified)'
  try {
    const signup = await (prisma as any).signupRequest.findFirst({
      where:   { companyName: { contains: req_data.tenant.name.split(' ')[0] } },
      orderBy: { createdAt: 'desc' },
      select:  { bcVersion: true },
    })
    if (signup?.bcVersion) {
      const vMap: Record<string, string> = {
        BC14: 'BC 14 (on-premise, C/AL + AL hybrid)',
        BC15: 'BC 15 (on-premise, AL extensions)',
        BC20: 'BC 20 (on-premise/SaaS)',
        BC21: 'BC 21 (on-premise/SaaS)',
        BC22: 'BC 22 (on-premise/SaaS)',
        BC23: 'BC 23 (on-premise/SaaS)',
        BC24: 'BC 24 (on-premise/SaaS)',
        BC25: 'BC 25 (on-premise/SaaS)',
        NAV2018: 'NAV 2018 (C/AL, on-premise)',
        NAV2017: 'NAV 2017 (C/AL, on-premise)',
        NAV2016: 'NAV 2016 (C/AL, on-premise)',
      }
      bcVersion = vMap[signup.bcVersion] ?? signup.bcVersion
    } else if (req_data.tenant.bcInstance) {
      bcVersion = `Business Central (instance: ${req_data.tenant.bcInstance})`
    }
  } catch { /* use default */ }

  // Read customerAnswers from request body (answers to AI questions being fed back in)
  let bodyAnswers = ''
  try {
    const body = await req.json()
    bodyAnswers = body.customerAnswers ?? ''
  } catch { /* no body */ }

  const customerAnswers = bodyAnswers || req_data.customerAnswers || ''

  const prompt = [
    `BC Area: ${req_data.bcArea}`,
    `Priority: ${req_data.priority.replace(/_/g, ' ')}`,
    `Title: ${req_data.title}`,
    ``,
    `Customer description:`,
    req_data.description,
    customerAnswers ? `\nCustomer's additional context / answers to clarifying questions:\n${customerAnswers}` : '',
  ].filter(Boolean).join('\n')

  let spec: object
  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
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

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data: {
      aiSpec:          JSON.stringify(spec),
      customerAnswers: customerAnswers || undefined,
    },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({ requirement: updated, spec })
}
