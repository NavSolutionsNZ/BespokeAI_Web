import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

function isTenantAdmin(role: string) {
  return role === 'tenant_admin' || role === 'superadmin'
}

function generateTempPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!'
}

async function getTarget(id: string, tenantId: string) {
  return prisma.user.findFirst({ where: { id, tenantId } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const target = await getTarget(params.id, tenantId)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'disable') {
    await prisma.user.update({ where: { id: params.id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'enable') {
    await prisma.user.update({ where: { id: params.id }, data: { active: true } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'reset') {
    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 12)
    await prisma.user.update({ where: { id: params.id }, data: { password: hashed } })
    return NextResponse.json({ ok: true, tempPassword })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const selfId = (session.user as any).id

  // Cannot delete yourself
  if (params.id === selfId) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }
  const target = await getTarget(params.id, tenantId)
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
