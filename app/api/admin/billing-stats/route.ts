import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// NZD amount in cents → display dollars
function cents(amount: number | null): number {
  return Math.round((amount ?? 0) / 100)
}

// Plan label from price ID
function planLabel(priceId: string | null): string {
  if (!priceId) return 'Unknown'
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_ASSISTANT_MONTHLY ?? '']: 'Assistant (monthly)',
    [process.env.STRIPE_PRICE_ASSISTANT_ANNUAL  ?? '']: 'Assistant (annual)',
    [process.env.STRIPE_PRICE_MANAGER_MONTHLY   ?? '']: 'Manager (monthly)',
    [process.env.STRIPE_PRICE_MANAGER_ANNUAL    ?? '']: 'Manager (annual)',
    [process.env.STRIPE_PRICE_EXECUTIVE_MONTHLY ?? '']: 'Executive (monthly)',
    [process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL  ?? '']: 'Executive (annual)',
  }
  return map[priceId] ?? priceId
}

// Tier from price ID
function tierOf(priceId: string | null): 'assistant' | 'manager' | 'executive' | 'unknown' {
  if (!priceId) return 'unknown'
  if ([process.env.STRIPE_PRICE_ASSISTANT_MONTHLY, process.env.STRIPE_PRICE_ASSISTANT_ANNUAL].includes(priceId)) return 'assistant'
  if ([process.env.STRIPE_PRICE_MANAGER_MONTHLY,   process.env.STRIPE_PRICE_MANAGER_ANNUAL].includes(priceId))   return 'manager'
  if ([process.env.STRIPE_PRICE_EXECUTIVE_MONTHLY, process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL].includes(priceId)) return 'executive'
  return 'unknown'
}

function tierCounts(subs: { items: { data: { price: { id: string } }[] } }[]) {
  return subs.reduce((acc, s) => {
    const t = tierOf(s.items.data[0]?.price?.id ?? null)
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// Convert annual amount to monthly equivalent for MRR
function toMonthly(amount: number, priceId: string): number {
  const annualIds = [
    process.env.STRIPE_PRICE_ASSISTANT_ANNUAL,
    process.env.STRIPE_PRICE_MANAGER_ANNUAL,
    process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL,
  ]
  return annualIds.includes(priceId) ? Math.round(amount / 12) : amount
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now   = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Fetch active subscriptions (up to 100 — sufficient for early stage)
  const activeSubs = await stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.customer'] })

  // Fetch recently cancelled (last 90 days for context)
  const ninetyDaysAgo = Math.floor(monthStart.getTime() / 1000)
  const cancelledSubs = await stripe.subscriptions.list({ status: 'canceled', limit: 100, expand: ['data.customer'] })

  // ── Active subscription stats ─────────────────────────────────────────────
  const activeList = activeSubs.data

  const newToday = activeList.filter(s => s.start_date * 1000 >= todayStart.getTime())
  const newMonth = activeList.filter(s => s.start_date * 1000 >= monthStart.getTime())

  const todayValue  = newToday.reduce((sum, s) => sum + cents(s.items.data[0]?.price?.unit_amount ?? 0), 0)
  const monthValue  = newMonth.reduce((sum, s) => sum + cents(s.items.data[0]?.price?.unit_amount ?? 0), 0)

  // MRR — convert annual to monthly equivalent
  const mrr = activeList.reduce((sum, s) => {
    const item    = s.items.data[0]
    const amount  = cents(item?.price?.unit_amount ?? 0)
    const priceId = item?.price?.id ?? ''
    return sum + toMonthly(amount, priceId)
  }, 0)

  // ── Cancellations ─────────────────────────────────────────────────────────
  // Build a set of customer IDs that still have an active subscription —
  // if a cancelled sub belongs to one of these, it was an upgrade not a churn.
  const activeCustomerIds = new Set(activeList.map(s => s.customer as string))

  const cancelledThisMonth = cancelledSubs.data.filter(s => {
    if ((s.canceled_at ?? 0) * 1000 < monthStart.getTime()) return false
    // Exclude upgrades — customer still has an active sub
    if (activeCustomerIds.has(s.customer as string)) return false
    return true
  })

  const cancellations = cancelledThisMonth.map(s => {
    const customer = s.customer as any
    const details  = (s as any).cancellation_details ?? {}
    return {
      id:       s.id,
      customer: customer?.email ?? customer?.name ?? 'Unknown',
      plan:     planLabel(s.items.data[0]?.price?.id ?? null),
      cancelledAt: new Date((s.canceled_at ?? 0) * 1000).toISOString(),
      reason:   details.reason   ?? null,  // billing_error | cancellation_requested | payment_disputed
      feedback: details.feedback ?? null,  // customer_service | low_quality | missing_features | other | switched_service | too_complex | too_expensive | unused
      comment:  details.comment  ?? null,  // free text from portal survey
    }
  })

  // ── New sub detail lists ──────────────────────────────────────────────────
  const newMonthList = newMonth.map(s => {
    const customer = s.customer as any
    return {
      id:         s.id,
      customer:   customer?.email ?? customer?.name ?? 'Unknown',
      plan:       planLabel(s.items.data[0]?.price?.id ?? null),
      startedAt:  new Date(s.start_date * 1000).toISOString(),
      valueNZD:   cents(s.items.data[0]?.price?.unit_amount ?? 0),
    }
  })

  return NextResponse.json({
    mrr,
    active: activeList.length,
    byTier: tierCounts(activeList),
    newToday:  { count: newToday.length,  valueNZD: todayValue, byTier: tierCounts(newToday) },
    newMonth:  { count: newMonth.length,  valueNZD: monthValue, byTier: tierCounts(newMonth), list: newMonthList },
    cancelled: { count: cancellations.length, lostMRR, list: cancellations },
  })
}
