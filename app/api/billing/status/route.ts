import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = (session.user as any).tenantId
  if (!tenantId) return NextResponse.json({ tier: 'free', subscriptionStatus: null, prices: {} })

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true, trialEndsAt: true },
  })

  // Resolve subscription status separately (new field, use as any)
  const tenantFull = await (prisma as any).tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionStatus: true },
  })

  // Price IDs are server-only env vars — expose them here so the client billing page can use them
  return NextResponse.json({
    tier: tenant?.tier ?? 'free',
    subscriptionStatus: tenantFull?.subscriptionStatus ?? null,
    trialEndsAt: tenant?.trialEndsAt ?? null,
    prices: {
      assistant_month:  process.env.STRIPE_PRICE_ASSISTANT_MONTHLY ?? null,
      assistant_year:   process.env.STRIPE_PRICE_ASSISTANT_ANNUAL  ?? null,
      manager_month:    process.env.STRIPE_PRICE_MANAGER_MONTHLY   ?? null,
      manager_year:     process.env.STRIPE_PRICE_MANAGER_ANNUAL    ?? null,
      executive_month:  process.env.STRIPE_PRICE_EXECUTIVE_MONTHLY ?? null,
      executive_year:   process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL  ?? null,
    },
  })
}
