import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantById } from '@/lib/tenants'

export const dynamic = 'force-dynamic'

// GET /api/health
// Pings the tenant's BCAgent /health endpoint and returns live status.
// Called by the dashboard every 60 s — runs server-side so the API key
// never touches the browser and CORS is not an issue.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getTenantById((session.user as any).tenantId)
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const url = `${tenant.agentBaseUrl}/health`
  const start = Date.now()

  try {
    const res = await fetch(url, {
      headers: { 'X-BespoxAI-Key': tenant.apiKey },
      signal: AbortSignal.timeout(10_000),
    })

    const latencyMs = Date.now() - start
    let body: any = {}
    try { body = await res.json() } catch { /* agent may return plain text */ }

    return NextResponse.json({
      ok:          res.ok,
      status:      res.ok ? 'ok' : 'error',
      httpStatus:  res.status,
      latencyMs,
      checkedAt:   new Date().toISOString(),
      agentVersion: body.version ?? null,
      agentDetail:  body,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok:         false,
      status:     'error',
      latencyMs:  Date.now() - start,
      checkedAt:  new Date().toISOString(),
      error:      err.message,
    })
  }
}
