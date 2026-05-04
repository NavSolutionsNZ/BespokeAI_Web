import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'
  const body = await req.json()

  const existing = await (prisma as any).requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!isSuperadmin && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: any = {}

  if (isSuperadmin) {
    if (body.status !== undefined)          updateData.status          = body.status
    if (body.quote !== undefined)           updateData.quote           = body.quote !== null ? parseFloat(body.quote) : null
    if (body.consultantNote !== undefined)  updateData.consultantNote  = body.consultantNote
    if (body.aiSpec !== undefined)          updateData.aiSpec          = body.aiSpec
    if (body.adminQuestions !== undefined)  updateData.adminQuestions  = body.adminQuestions
    // Auto-set quoteApprovedAt when approved
    if (body.status === 'approved' && !existing.quoteApprovedAt) {
      updateData.quoteApprovedAt = new Date()
    }
    // Send back → needs_clarification
    if (body.status === 'needs_clarification' && body.adminQuestions) {
      updateData.adminQuestions = body.adminQuestions
    }
  } else {
    // Customer / tenant_admin
    const { status, title, description, bcArea, priority, customerAnswers } = body

    // Submit (draft → submitted, or needs_clarification → submitted)
    if (status === 'submitted' && (existing.status === 'draft' || existing.status === 'needs_clarification')) {
      updateData.status = 'submitted'
    }
    // Approve quote (quoted → approved)
    if (status === 'approved' && existing.status === 'quoted') {
      updateData.status = 'approved'
      updateData.quoteApprovedAt = new Date()
    }
    // Edit while draft
    if (existing.status === 'draft' || existing.status === 'needs_clarification') {
      if (title !== undefined)           updateData.title           = title.trim()
      if (description !== undefined)     updateData.description     = description.trim()
      if (bcArea !== undefined)          updateData.bcArea          = bcArea
      if (priority !== undefined)        updateData.priority        = priority
      if (customerAnswers !== undefined) updateData.customerAnswers = customerAnswers
    }
  }

  const updated = await (prisma as any).requirement.update({
    where: { id: params.id },
    data: updateData,
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({ requirement: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'

  const existing = await (prisma as any).requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!isSuperadmin && (existing.status !== 'draft' || existing.tenantId !== user.tenantId)) {
    return NextResponse.json({ error: 'Cannot delete a submitted requirement' }, { status: 403 })
  }

  await (prisma as any).requirement.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
