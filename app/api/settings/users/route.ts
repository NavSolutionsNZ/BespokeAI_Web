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

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const body = await req.json().catch(() => ({}))
  const { email, name, userRole = 'user' } = body

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // tenant_admin cannot create superadmins
  if (userRole === 'superadmin') {
    return NextResponse.json({ error: 'Cannot create superadmin' }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const tempPassword = generateTempPassword()
  const hashed = await bcrypt.hash(tempPassword, 12)

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name?.trim() || email,
      password: hashed,
      role: userRole,
      tenantId,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })

  return NextResponse.json({ user, tempPassword })
}
