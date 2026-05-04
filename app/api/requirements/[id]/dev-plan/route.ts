import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DEV_PLAN_SYSTEM = `You are a senior Microsoft Dynamics 365 Business Central / NAV developer and technical lead with 20+ years of experience delivering BC customisations on-premise and SaaS. You are writing an INTERNAL development plan for your team — not for the customer.

Your plan must be detailed enough to:
- Allow a developer to start work immediately
- Support accurate time and cost estimation
- Identify all technical risks upfront
- Define a clear testing and deployment strategy

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "summary": "2-3 sentence technical overview of what will be built and the core approach",
  "approach": "Detailed technical approach — which AL patterns to use, extension architecture, any 3rd party dependencies",
  "tasks": [
    {
      "title": "Short task title",
      "description": "Detailed description of exactly what code changes are required",
      "objects": ["Table 36 Sales Header — add field X (Option type)", "Page 42 Sales Order — add field to FastTab Y"],
      "estimatedHours": 4,
      "phase": "Development | Testing | Deployment | Documentation"
    }
  ],
  "totalEstimatedHours": 24,
  "suggestedDailyRate": 1200,
  "quotingNotes": "Internal notes on pricing — complexity factors, risks to margin, what to watch for in scope creep, whether to quote fixed-price or T&M",
  "risks": [
    "Risk: BC version-specific limitation or gotcha — mitigation approach"
  ],
  "testingPlan": "Specific test scenarios required — unit, integration, UAT. What the customer must sign off on.",
  "deploymentNotes": "How to deploy — extension packaging, environment promotion steps, data migration if needed, rollback plan",
  "assumptions": [
    "Any assumption that if wrong would change the estimate significantly"
  ]
}

Rules:
- Be ruthlessly specific about AL objects and code patterns
- estimatedHours per task should be realistic — include thinking/design time not just typing time
- suggestedDailyRate is in NZD — typical BC developer rate
- quotingNotes is for YOUR eyes only — be candid about risk, margin, and what to watch for
- risks must include mitigation approaches, not just problems
- totalEstimatedHours should sum the tasks (add 15-20% contingency)`

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

  // Parse existing AI spec for context
  let specContext = ''
  try {
    if (req_data.aiSpec) {
      const spec = JSON.parse(req_data.aiSpec)
      specContext = [
        spec.userStory ? `User Story: ${spec.userStory}` : '',
        spec.acceptanceCriteria?.length ? `Acceptance Criteria:\n${spec.acceptanceCriteria.map((c: string, i: number) => `${i+1}. ${c}`).join('\n')}` : '',
        spec.bcObjects?.length ? `BC Objects identified: ${spec.bcObjects.join(', ')}` : '',
        spec.complexity ? `Estimated complexity: ${spec.complexity} (~${spec.estimatedDays} days)` : '',
        spec.assumptions?.length ? `Assumptions: ${spec.assumptions.join('; ')}` : '',
        spec.notes ? `Technical notes: ${spec.notes}` : '',
      ].filter(Boolean).join('\n\n')
    }
  } catch { /* ignore */ }

  // Parse Q&A for additional context
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

  const prompt = [
    `INTERNAL DEVELOPMENT PLAN REQUEST`,
    `Customer: ${req_data.tenant.name}`,
    `BC Version: ${bcVersion}`,
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
    `Generate a detailed internal development plan for quoting and planning purposes.`,
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
