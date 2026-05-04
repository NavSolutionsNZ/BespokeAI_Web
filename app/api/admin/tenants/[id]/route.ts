import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/tenants/[id] — toggle active or update fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { active, name } = body

  const tenant = await prisma.tenant.update({
    where: { id: params.id },
    data: {
      ...(active !== undefined && { active }),
      ...(name   !== undefined && { name }),
    },
  })

  return NextResponse.json({ tenant })
}
