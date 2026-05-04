import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function adminGuard(session: any) {
  if (!session?.user || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// PATCH /api/admin/users/[id]
// Body: { active?, role?, resetPassword? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const guard = adminGuard(session)
  if (guard) return guard

  // Prevent self-modification
  if ((session!.user as any).id === params.id)
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { active, role, resetPassword } = body

  const updateData: any = {}
  if (active    !== undefined) updateData.active = active
  if (role      !== undefined) updateData.role   = role === 'admin' ? 'admin' : 'user'

  let tempPassword: string | null = null
  if (resetPassword) {
    tempPassword = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 12)
    updateData.password = await bcrypt.hash(tempPassword, 12)
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data:  updateData,
    select: { id: true, email: true, name: true, role: true, active: true, tenantId: true },
  })

  return NextResponse.json({ user, ...(tempPassword ? { tempPassword } : {}) })
}

// DELETE /api/admin/users/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const guard = adminGuard(session)
  if (guard) return guard

  if ((session!.user as any).id === params.id)
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  try {
    // Delete query logs first (FK constraint)
    await prisma.queryLog.deleteMany({ where: { userId: params.id } })
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
