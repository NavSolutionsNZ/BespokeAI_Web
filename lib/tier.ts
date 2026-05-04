import { prisma } from '@/lib/db'

export type TierStatus =
  | { allowed: true }
  | { allowed: false; reason: 'trial_expired' | 'no_tenant' | 'unknown'; trialEndsAt?: string | null }

export async function checkTierAccess(tenantId: string): Promise<TierStatus> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true, trialEndsAt: true },
  })

  if (!tenant) return { allowed: false, reason: 'no_tenant' }

  // Paid / enterprise — always allowed
  if (tenant.tier === 'paid' || tenant.tier === 'enterprise') {
    return { allowed: true }
  }

  // Trial — check expiry
  if (tenant.tier === 'trial') {
    if (!tenant.trialEndsAt) return { allowed: true } // no expiry set = still valid
    if (new Date() < new Date(tenant.trialEndsAt)) return { allowed: true }
    return {
      allowed: false,
      reason: 'trial_expired',
      trialEndsAt: tenant.trialEndsAt.toISOString(),
    }
  }

  return { allowed: false, reason: 'unknown' }
}
