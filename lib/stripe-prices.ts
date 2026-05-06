// Plan definitions — price IDs are set after running /api/admin/stripe-setup
// and adding the returned IDs as Vercel environment variables.

export type PlanId = 'free' | 'assistant' | 'manager' | 'executive'
export type BillingInterval = 'month' | 'year'

export interface Plan {
  id: PlanId
  name: string
  monthlyNZD: number   // display price per month
  annualNZD: number    // total annual price (11 × monthly)
  description: string
  features: string[]
  includesAssistant: boolean
  includesManager: boolean
  includesExecutive: boolean
  discountOnServices: number  // percentage e.g. 10
  monthlyPriceId: string | undefined
  annualPriceId: string | undefined
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyNZD: 0,
    annualNZD: 0,
    description: 'Customisations & Migration Analyser only',
    features: [
      'Custom BC development requests',
      'Migration Analyser access',
      'Email support',
    ],
    includesAssistant: false,
    includesManager: false,
    includesExecutive: false,
    discountOnServices: 0,
    monthlyPriceId: undefined,
    annualPriceId: undefined,
  },
  {
    id: 'assistant',
    name: 'Assistant',
    monthlyNZD: 299,
    annualNZD: 3289,   // 11 × 299
    description: 'CFO Assistant + everything in Free',
    features: [
      'Everything in Free',
      'CFO Assistant (AI-powered BC queries)',
      'Query history & data visualisation',
      'Priority support',
    ],
    includesAssistant: true,
    includesManager: false,
    includesExecutive: false,
    discountOnServices: 0,
    monthlyPriceId: process.env.STRIPE_PRICE_ASSISTANT_MONTHLY,
    annualPriceId: process.env.STRIPE_PRICE_ASSISTANT_ANNUAL,
  },
  {
    id: 'manager',
    name: 'Manager',
    monthlyNZD: 499,
    annualNZD: 5489,   // 11 × 499
    description: 'Assistant + future One Day Close + everything in Free',
    features: [
      'Everything in Assistant',
      'One Day Close Assistant (coming soon)',
      'Advanced reporting',
      'Priority support',
    ],
    includesAssistant: true,
    includesManager: true,
    includesExecutive: false,
    discountOnServices: 0,
    monthlyPriceId: process.env.STRIPE_PRICE_MANAGER_MONTHLY,
    annualPriceId: process.env.STRIPE_PRICE_MANAGER_ANNUAL,
  },
  {
    id: 'executive',
    name: 'Executive',
    monthlyNZD: 999,
    annualNZD: 10989,  // 11 × 999
    description: 'Everything included + 10% off all paid services',
    features: [
      'Everything in Manager',
      '10% discount on Customisations',
      '10% discount on Migration Analyser',
      'Dedicated support',
    ],
    includesAssistant: true,
    includesManager: true,
    includesExecutive: true,
    discountOnServices: 10,
    monthlyPriceId: process.env.STRIPE_PRICE_EXECUTIVE_MONTHLY,
    annualPriceId: process.env.STRIPE_PRICE_EXECUTIVE_ANNUAL,
  },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find(p => p.id === id) ?? PLANS[0]
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return PLANS.find(
    p => p.monthlyPriceId === priceId || p.annualPriceId === priceId
  )
}

export function getIntervalByPriceId(priceId: string): BillingInterval {
  const plan = PLANS.find(p => p.annualPriceId === priceId)
  return plan ? 'year' : 'month'
}

/** Returns the service discount % for a given tier */
export function getServiceDiscount(tier: string): number {
  if (tier === 'executive') return 10
  return 0
}
