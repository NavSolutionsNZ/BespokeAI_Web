/**
 * GET /api/billing/review-allowance
 * Returns the current tenant's monthly senior review allowance status.
 * Used by RequirementsBuilder to label the submit button.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReviewAllowance } from '@/lib/tier'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const tenantId = user.tenantId

  if (!tenantId) return NextResponse.json({ included: 0, used: 0, remaining: 0 })

  const allowance = await getReviewAllowance(tenantId)
  return NextResponse.json(allowance)
}
