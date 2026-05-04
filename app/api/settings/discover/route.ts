import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BC_ENTITIES } from '@/lib/bc-entities'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session?.user || (role !== 'tenant_admin' && role !== 'superadmin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = (session.user as any).tenantId
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const metaUrl = `https://${tenant.tunnelSubdomain}-agent.bespoxai.com/${tenant.bcInstance}/ODataV4/$metadata`

  let bcEntityNames: string[] = []
  let fetchError: string | null = null

  try {
    const res = await fetch(metaUrl, {
      headers: { 'X-BespoxAI-Key': tenant.apiKey, Accept: 'application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`BCAgent returned HTTP ${res.status}`)
    const xml = await res.text()
    const re = /EntitySet\s+Name="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) bcEntityNames.push(m[1])
    bcEntityNames = Array.from(new Set(bcEntityNames))
  } catch (e: any) {
    fetchError = e.message
  }

  if (fetchError) {
    return NextResponse.json({ error: `Discovery failed: ${fetchError}` }, { status: 502 })
  }

  // Build entity config: catalogue entities found in BC default to enabled,
  // preserve any existing enabled/disabled choices the user has already made.
  const existing: Record<string, boolean> = (tenant.entityConfig as any) ?? {}
  const bcSet = new Set(bcEntityNames)
  const newConfig: Record<string, boolean> = {}

  for (const name of Object.keys(BC_ENTITIES)) {
    if (bcSet.has(name)) {
      // Keep existing choice if set, otherwise default to enabled
      newConfig[name] = existing[name] !== undefined ? existing[name] : true
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { entityConfig: newConfig },
  })

  return NextResponse.json({
    entityConfig: newConfig,
    discovered: bcEntityNames.length,
    enabled: Object.values(newConfig).filter(Boolean).length,
  })
}
