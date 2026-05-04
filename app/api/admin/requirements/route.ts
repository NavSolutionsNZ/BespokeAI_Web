import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function superadminGuard(session: any) {
  if (!session?.user || (session.user as any).role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET /api/admin/requirements — all requirements across all tenants
export async function GET() {
  const session = await getServerSession(authOptions)
  const guard = superadminGuard(session)
  if (guard) return guard

  const requirements = await prisma.requirement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user:   { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  })

  // Count by status for dashboard stats
  const statusCounts = requirements.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({ requirements, statusCounts })
}
