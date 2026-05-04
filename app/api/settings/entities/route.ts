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
    select: { entityConfig: true },
  })
  return NextResponse.json({ entityConfig: tenant?.entityConfig ?? null })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const body = await req.json().catch(() => ({}))
  if (!body.entityConfig) {
    return NextResponse.json({ error: 'entityConfig required' }, { status: 400 })
  }
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { entityConfig: body.entityConfig },
  })
  return NextResponse.json({ entityConfig: tenant.entityConfig })
}
