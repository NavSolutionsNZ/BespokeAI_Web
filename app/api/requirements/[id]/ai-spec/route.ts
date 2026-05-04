import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SPEC_SYSTEM = `You are a senior Microsoft Dynamics 365 Business Central (BC) functional consultant and solution architect. 
Your job is to take a plain-English customisation request and produce a professional, structured functional specification.

Respond ONLY with a valid JSON object — no markdown, no explanation. Use this exact shape:
{
  "userStory": "As a [role], I want [capability] so that [business value].",
  "acceptanceCriteria": [
    "When [condition], then [expected outcome].",
    "..."
  ],
  "bcObjects": ["e.g. Page 42 Sales Order", "Codeunit 80 Sales-Post", "Table 36 Sales Header"],
  "complexity": "Simple | Medium | Complex",
  "estimatedDays": <number>,
  "notes": "Any BC-specific technical notes, known limitations, or recommended approaches."
}

Complexity guide:
- Simple: minor field additions, basic validation, label changes (1–3 days)
- Medium: new workflows, reports, integrations (4–10 days)
- Complex: major new modules, deep integrations, multi-table changes (10+ days)`

// POST /api/requirements/[id]/ai-spec — generate AI functional spec for a requirement
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

  const req_data = await prisma.requirement.findUnique({ where: { id: params.id } })
  if (!req_data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Must belong to user's tenant (or superadmin)
  if (user.role !== 'superadmin' && req_data.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const prompt = `BC Area: ${req_data.bcArea}
Priority: ${req_data.priority.replace(/_/g, ' ')}
Title: ${req_data.title}

User's description:
${req_data.description}

Generate a structured BC functional specification for this customisation request.`

  let spec: object
  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      temperature: 0.3,
      messages: [
        { role: 'system',  content: SPEC_SYSTEM },
        { role: 'user',    content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
    spec = JSON.parse(cleaned)
  } catch (err) {
    console.error('AI spec generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 })
  }

  // Save the spec back to the requirement
  const updated = await prisma.requirement.update({
    where: { id: params.id },
    data:  { aiSpec: JSON.stringify(spec) },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({ requirement: updated, spec })
}
