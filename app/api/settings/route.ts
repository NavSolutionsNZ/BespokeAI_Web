import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isTenantAdmin(role: string) {
  return role === 'tenant_admin' || role === 'superadmin'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, tunnelSubdomain: true, bcInstance: true,
      bcCompany: true, active: true, country: true, entityConfig: true,
      tunnelId: true, createdAt: true,
    },
  })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ tenant })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const body = await req.json().catch(() => ({}))
  const { country, bcPort, agentPort, navProduct, navVersion, lastCU } = body

  const data: Record<string, any> = {}

  if (country !== undefined) {
    if (typeof country !== 'string' || country.length > 4) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }
    data.country = country.toUpperCase()
  }
  if (bcPort !== undefined) {
    const p = parseInt(bcPort, 10)
    if (isNaN(p) || p < 1 || p > 65535) return NextResponse.json({ error: 'Invalid bcPort' }, { status: 400 })
    data.bcPort = p
  }
  if (agentPort !== undefined) {
    const p = parseInt(agentPort, 10)
    if (isNaN(p) || p < 1 || p > 65535) return NextResponse.json({ error: 'Invalid agentPort' }, { status: 400 })
    data.agentPort = p
  }
  if (navProduct !== undefined) data.navProduct = navProduct || null
  if (navVersion !== undefined) data.navVersion = navVersion || null
  if (lastCU     !== undefined) data.lastCU     = lastCU     || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const tenant = await (prisma as any).tenant.update({ where: { id: tenantId }, data })
  return NextResponse.json({ tenant })
}
