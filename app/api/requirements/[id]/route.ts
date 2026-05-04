import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/requirements/[id] — update a requirement
// Users can: submit (draft→submitted), approve quote (quoted→approved)
// tenant_admin can do same as user for their tenant's requirements
// superadmin can: change status to anything, set quote, consultantNote
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'
  const body = await req.json()

  const existing = await prisma.requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Non-superadmin can only touch their own tenant's requirements
  if (!isSuperadmin && existing.tenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: any = {}

  if (isSuperadmin) {
    // Superadmin can update: status, quote, consultantNote, aiSpec
    if (body.status !== undefined)         updateData.status         = body.status
    if (body.quote !== undefined)          updateData.quote          = body.quote !== null ? parseFloat(body.quote) : null
    if (body.consultantNote !== undefined) updateData.consultantNote = body.consultantNote
    if (body.aiSpec !== undefined)         updateData.aiSpec         = body.aiSpec
    // Auto-set quoteApprovedAt when status becomes approved
    if (body.status === 'approved' && !existing.quoteApprovedAt) {
      updateData.quoteApprovedAt = new Date()
    }
  } else {
    // Regular user / tenant_admin: can submit draft, approve quote, update title/description while draft
    const { status, title, description, bcArea, priority } = body

    if (status === 'submitted' && existing.status === 'draft') {
      updateData.status = 'submitted'
    }
    if (status === 'approved' && existing.status === 'quoted') {
      updateData.status = 'approved'
      updateData.quoteApprovedAt = new Date()
    }
    if (existing.status === 'draft') {
      if (title !== undefined)       updateData.title       = title.trim()
      if (description !== undefined) updateData.description = description.trim()
      if (bcArea !== undefined)      updateData.bcArea      = bcArea
      if (priority !== undefined)    updateData.priority    = priority
    }
  }

  const updated = await prisma.requirement.update({
    where: { id: params.id },
    data: updateData,
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  return NextResponse.json({ requirement: updated })
}

// DELETE /api/requirements/[id] — delete (only draft, only owner or superadmin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const isSuperadmin = user.role === 'superadmin'

  const existing = await prisma.requirement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only allow deleting drafts (unless superadmin)
  if (!isSuperadmin && (existing.status !== 'draft' || existing.tenantId !== user.tenantId)) {
    return NextResponse.json({ error: 'Cannot delete a submitted requirement' }, { status: 403 })
  }

  await prisma.requirement.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
