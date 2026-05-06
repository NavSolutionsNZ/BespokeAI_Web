import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = (session.user as any).tenantId
  if (!tenantId) return NextResponse.json({ tier: 'free', subscriptionStatus: null })

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true, subscriptionStatus: true, trialEndsAt: true },
  })

  return NextResponse.json({
    tier: tenant?.tier ?? 'free',
    subscriptionStatus: (tenant as any)?.subscriptionStatus ?? null,
    trialEndsAt: tenant?.trialEndsAt ?? null,
  })
}
