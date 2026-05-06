import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const enquiries = await (prisma as any).migrationEnquiry.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: { select: { name: true } },
      user:   { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ enquiries })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if ((session?.user as any)?.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status } = await req.json()
  const updated = await (prisma as any).migrationEnquiry.update({
    where: { id },
    data:  { status },
  })
  return NextResponse.json({ enquiry: updated })
}
