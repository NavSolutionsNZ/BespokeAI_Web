import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'
  const body = await req.json()

  const existing = await (prisma as any).requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isSuperadmin && existing.tenantId !== user.tenantId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updateData: any = {}

  if (isSuperadmin) {
    if (body.status !== undefined)               updateData.status               = body.status
    if (body.quote !== undefined)                updateData.quote                = body.quote !== null ? parseFloat(body.quote) : null
    if (body.consultantNote !== undefined)       updateData.consultantNote       = body.consultantNote
    if (body.aiSpec !== undefined)               updateData.aiSpec               = body.aiSpec
    if (body.adminQuestions !== undefined)       updateData.adminQuestions       = body.adminQuestions
    if (body.status === 'needs_clarification' && body.adminQuestions)
      updateData.adminQuestions = body.adminQuestions
    // Admin marks deposit paid
    if (body.status === 'deposit_paid') {
      updateData.status = 'deposit_paid'
      updateData.depositPaidAt = new Date()
    }
    // Admin marks balance paid → fully_paid
    if (body.status === 'fully_paid') {
      updateData.status = 'fully_paid'
      updateData.balancePaidAt = new Date()
    }
    // Admin starts dev after deposit confirmed
    if (body.status === 'in_development' && existing.status === 'deposit_paid') {
      updateData.status = 'in_development'
    }
    // Admin marks complete (→ balance required)
    if (body.status === 'complete_pending_payment' && existing.status === 'in_development') {
      updateData.status = 'complete_pending_payment'
    }
  } else {
    // Customer / tenant_admin
    const { status, title, description, bcArea, priority, customerAnswers, quoteRejectionReason } = body

    // Submit (draft → submitted, or needs_clarification → submitted)
    if (status === 'submitted' && ['draft', 'needs_clarification', 'quote_rejected'].includes(existing.status)) {
      updateData.status = 'submitted'
    }
    // Approve quote → deposit_required (20% deposit)
    if (status === 'deposit_required' && existing.status === 'quoted') {
      updateData.status = 'deposit_required'
      updateData.quoteApprovedAt = new Date()
      // Auto-calculate 20% deposit
      if (existing.quote) {
        updateData.depositAmount = parseFloat(existing.quote.toString()) * 0.2
      }
    }
    // Reject quote
    if (status === 'quote_rejected' && existing.status === 'quoted') {
      updateData.status = 'quote_rejected'
      updateData.quoteRejectedAt = new Date()
      updateData.quoteRejectionReason = quoteRejectionReason ?? ''
    }
    // Edit while in editable states
    if (['draft', 'needs_clarification', 'quote_rejected'].includes(existing.status)) {
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'

  const existing = await (prisma as any).requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isSuperadmin && (existing.status !== 'draft' || existing.tenantId !== user.tenantId))
    return NextResponse.json({ error: 'Cannot delete a submitted requirement' }, { status: 403 })

  await (prisma as any).requirement.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
