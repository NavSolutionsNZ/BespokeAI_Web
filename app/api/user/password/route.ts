import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// PATCH /api/user/password
// Body: { currentPassword, newPassword }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  if (!userId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 })

  if (newPassword.length < 8)
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })

  return NextResponse.json({ ok: true })
}
