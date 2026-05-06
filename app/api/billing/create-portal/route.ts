import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = (session.user as any).tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const customerId = (tenant as any)?.stripeCustomerId as string | null

  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://bespoxai.com'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard`,
  })

  return NextResponse.json({ url: portalSession.url })
}
