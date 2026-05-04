import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantById } from '@/lib/tenants'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isTenantAdmin(role: string) {
  return role === 'tenant_admin' || role === 'superadmin'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || !isTenantAdmin(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = (session.user as any).tenantId
  const tenant = await getTenantById(tenantId)
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Forward to the admin installer endpoint
  const body = await req.json().catch(() => ({}))
  const adminRes = await fetch(
    new URL(`/api/admin/installer/${tenantId}`, req.url).toString(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify(body),
    }
  )

  if (!adminRes.ok) {
    const err = await adminRes.json().catch(() => ({}))
    return NextResponse.json(err, { status: adminRes.status })
  }

  // Stream the zip back
  const blob = await adminRes.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="BespoxAI-Installer-${tenant.name.replace(/\s+/g, '_')}.zip"`,
    },
  })
}
