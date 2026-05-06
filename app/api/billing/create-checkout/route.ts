import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { priceId } = await req.json()
  if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Reuse existing Stripe customer or create new one
  let customerId = (tenant as any).stripeCustomerId as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant.name,
      metadata: { tenantId },
    })
    customerId = customer.id
    await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customerId },
    })
  }

  const origin = req.headers.get('origin') ?? 'https://bespoxai.com'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?billing=success`,
    cancel_url: `${origin}/billing`,
    metadata: { tenantId },
    subscription_data: { metadata: { tenantId } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
