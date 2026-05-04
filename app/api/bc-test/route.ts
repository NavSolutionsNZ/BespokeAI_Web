import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantById } from '@/lib/tenants'

export const dynamic = 'force-dynamic'

// GET /api/bc-test?entity=Customer
// Tests a BC OData entity and returns raw response or error
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenantById((session.user as any).tenantId)
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get('entity') ?? '$metadata'
  const top = searchParams.get('top') ?? '2'

  const url = entity === '$metadata'
    ? `${tenant.agentBaseUrl}/${tenant.bcInstance}/ODataV4/$metadata`
    : `${tenant.agentBaseUrl}/${tenant.bcInstance}/ODataV4/Company('${tenant.bcCompany}')/${entity}?$top=${top}`

  try {
    const res = await fetch(url, {
      headers: { 'X-BespoxAI-Key': tenant.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    const text = await res.text()
    let parsed: any = null
    try { parsed = JSON.parse(text) } catch {}

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      url,
      entity,
      response: parsed ?? text.slice(0, 2000),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, url }, { status: 500 })
  }
}
