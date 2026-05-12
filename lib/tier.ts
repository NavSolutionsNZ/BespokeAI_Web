import { prisma } from '@/lib/db'

export type TierStatus =
  | { allowed: true }
  | { allowed: false; reason: 'no_plan' | 'trial_expired' | 'no_tenant' | 'unknown'; trialEndsAt?: string | null }

/**
 * Check whether a tenant has access to the CFO Assistant feature.
 * Tiers with access: trial (not expired), assistant, manager, executive
 * Tier without access: free
 */
export async function checkTierAccess(tenantId: string): Promise<TierStatus> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true, trialEndsAt: true },
  })

  if (!tenant) return { allowed: false, reason: 'no_tenant' }

  // Paid subscription tiers — always allowed
  if (['assistant', 'manager', 'executive'].includes(tenant.tier)) {
    return { allowed: true }
  }

  // Legacy: paid / enterprise — always allowed
  if (tenant.tier === 'paid' || tenant.tier === 'enterprise') {
    return { allowed: true }
  }

  // Trial — check expiry
  if (tenant.tier === 'trial') {
    if (!tenant.trialEndsAt) return { allowed: true }
    if (new Date() < new Date(tenant.trialEndsAt)) return { allowed: true }
    return {
      allowed: false,
      reason: 'trial_expired',
      trialEndsAt: tenant.trialEndsAt.toISOString(),
    }
  }

  // Free tier — no assistant access
  if (tenant.tier === 'free') {
    return { allowed: false, reason: 'no_plan' }
  }

  return { allowed: false, reason: 'unknown' }
}

/**
 * Check if a tenant has access to a specific feature.
 * Extend this as new features are gated per plan.
 */
export async function checkFeatureAccess(
  tenantId: string,
  feature: 'assistant' | 'manager' | 'executive'
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true },
  })
  if (!tenant) return false
  const tier = tenant.tier

  switch (feature) {
    case 'assistant':
      return ['assistant', 'manager', 'executive', 'paid', 'enterprise', 'trial'].includes(tier)
    case 'manager':
      return ['manager', 'executive'].includes(tier)
    case 'executive':
      return tier === 'executive'
    default:
      return false
  }
}

/**
 * Get the monthly senior developer review allowance for a tenant.
 * Manager = 1 included review/month, Executive = 2/month, others = 0.
 */
export async function getReviewAllowance(
  tenantId: string
): Promise<{ included: number; used: number; remaining: number }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true },
  })

  const tier = tenant?.tier ?? 'free'
  const included = tier === 'executive' ? 2 : tier === 'manager' ? 1 : 0

  if (included === 0) return { included: 0, used: 0, remaining: 0 }

  // Count reviews consumed this calendar month via allowance
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const used = await (prisma as any).requirement.count({
    where: {
      tenantId,
      reviewIncluded: true,
      reviewSubmittedAt: { gte: monthStart },
    },
  })

  return { included, used, remaining: Math.max(0, included - used) }
}
