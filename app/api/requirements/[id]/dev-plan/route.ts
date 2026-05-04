import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DEV_PLAN_SYSTEM = `You are a senior Microsoft Dynamics 365 Business Central / NAV developer and technical lead with 20+ years experience. You are writing an INTERNAL development plan — not for the customer.

Your plan must allow a developer to start work immediately, support accurate quoting, identify all risks, and define testing/deployment strategy.

CRITICAL REQUIREMENT: For every Development phase task, include a codeSnippet with:
- Exact AL code (or C/AL for NAV/BC14) ready to paste
- Precise object names, field numbers, trigger names matching standard BC objects  
- Placement instructions: which file, which section (fields/triggers/procedures), where to insert
- Use tableextension/pageextension/codeunit/reportextension patterns correctly

Respond ONLY with valid JSON, no markdown:
{
  "summary": "2-3 sentence technical overview of what will be built",
  "approach": "Detailed technical approach — AL patterns, extension architecture, version-specific considerations",
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description of code changes required",
      "objects": ["Table 36 Sales Header — add field 50100 Approval_Status (Option)"],
      "estimatedHours": 4,
      "phase": "Development",
      "codeSnippet": {
        "filename": "SalesHeaderExt.TableExt.al",
        "placement": "New file in extension project src/ folder",
        "code": "tableextension 50100 SalesHeaderExt extends \"Sales Header\"\\n{\\n    fields\\n    {\\n        field(50100; \\\"Approval Status\\\"; Option)\\n        {\\n            OptionMembers = Open,Pending,Approved,Rejected;\\n            Caption = 'Approval Status';\\n            DataClassification = CustomerContent;\\n        }\\n    }\\n}"
      }
    }
  ],
  "totalEstimatedHours": 24,
  "suggestedDailyRate": 1200,
  "quotingNotes": "Internal pricing notes — complexity, margin risks, fixed-price vs T&M, scope creep vectors",
  "risks": ["Risk description — specific mitigation approach"],
  "testingPlan": "Specific test scenarios — unit, integration, UAT. What customer must sign off.",
  "deploymentNotes": "Extension packaging, environment promotion, data migration if needed, rollback plan",
  "assumptions": ["Assumption that if wrong would materially change the estimate"]
}

Rules:
- codeSnippet REQUIRED for every Development task — this is the primary value of this plan
- Use exact BC object IDs and field numbers from standard BC object model
- estimatedHours: include design/thinking time, not just typing
- suggestedDailyRate in NZD (typical BC dev rate: $1000-$1500/day)
- quotingNotes: be candid about risk and margin — internal only
- totalEstimatedHours: sum tasks + 15-20% contingency`

// POST /api/requirements/[id]/dev-plan — SUPERADMIN ONLY
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const req_data = await (prisma as any).requirement.findUnique({
    where: { id: params.id },
    include: { tenant: { select: { bcInstance: true, name: true } } },
  })
  if (!req_data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // BC version lookup
  let bcVersion = 'Business Central (version not specified)'
  let bcInstance = req_data.tenant?.bcInstance ?? null
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
    } else if (bcInstance) {
      bcVersion = `Business Central (instance: ${bcInstance})`
    }
  } catch { /* use default */ }

  // Parse existing AI spec for context
  let specContext = ''
  try {
    if (req_data.aiSpec) {
      const spec = JSON.parse(req_data.aiSpec)
      specContext = [
        spec.userStory ? `User Story: ${spec.userStory}` : '',
        spec.acceptanceCriteria?.length ? `Acceptance Criteria:\n${spec.acceptanceCriteria.map((c: string, i: number) => `${i+1}. ${c}`).join('\n')}` : '',
        spec.bcObjects?.length ? `BC Objects identified:\n${spec.bcObjects.map((o: string) => `- ${o}`).join('\n')}` : '',
        spec.complexity ? `Estimated complexity: ${spec.complexity} (~${spec.estimatedDays} days)` : '',
        spec.assumptions?.length ? `Assumptions: ${spec.assumptions.join('; ')}` : '',
        spec.notes ? `Technical notes: ${spec.notes}` : '',
      ].filter(Boolean).join('\n\n')
    }
  } catch { /* ignore */ }

  // Parse Q&A
  let qaContext = ''
  try {
    if (req_data.customerAnswers) {
      const qa = JSON.parse(req_data.customerAnswers)
      if (Array.isArray(qa) && qa[0]?.q) {
        qaContext = 'Customer clarifications:\n' + qa.map((p: any, i: number) => `Q${i+1}: ${p.q}\nA${i+1}: ${p.a}`).join('\n\n')
      } else {
        qaContext = `Customer additional context: ${req_data.customerAnswers}`
      }
    }
  } catch {
    if (req_data.customerAnswers) qaContext = `Customer context: ${req_data.customerAnswers}`
  }

  const bcNote = bcInstance
    ? `BC Instance: ${bcInstance} (tenant has a live BC connection — AL code should target this instance's version)`
    : `Note: No live BC instance connected for this tenant. Plan based on version info only. Standard AL patterns assumed.`

  const prompt = [
    `INTERNAL DEVELOPMENT PLAN`,
    `Customer: ${req_data.tenant.name}`,
    `BC Version: ${bcVersion}`,
    bcNote,
    `Area: ${req_data.bcArea} | Priority: ${req_data.priority.replace(/_/g, ' ')}`,
    ``,
    `--- REQUIREMENT ---`,
    `Title: ${req_data.title}`,
    ``,
    `Customer description:`,
    req_data.description,
    qaContext ? `\n${qaContext}` : '',
    specContext ? `\n--- FUNCTIONAL SPEC CONTEXT ---\n${specContext}` : '',
    ``,
    `Generate a detailed internal development plan with AL code snippets for every development task.`,
  ].filter(Boolean).join('\n')

  let plan: object
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: DEV_PLAN_SYSTEM },
        { role: 'user',   content: prompt },
      ],
    })
    const raw     = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
    plan = JSON.parse(cleaned)
  } catch (err) {
    console.error('Dev plan generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 })
  }

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data: { devPlan: JSON.stringify(plan) },
    select: { id: true, devPlan: true, updatedAt: true },
  })

  return NextResponse.json({ devPlan: plan, updatedAt: updated.updatedAt })
}
