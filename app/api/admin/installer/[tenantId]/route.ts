import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTunnelToken } from '@/lib/cloudflare'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

// GET /api/admin/installer/[tenantId]
// Generates a pre-configured Install-BespoxAI.ps1 for this tenant.
// Fetches the live tunnel token from Cloudflare, injects it + the API key
// into the script as default parameter values, and returns the file.
export async function GET(_req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (!tenant.tunnelId) {
    return NextResponse.json({
      error: 'This tenant was not provisioned automatically — no tunnel ID stored. Use the generic installer script instead.',
    }, { status: 400 })
  }

  // Fetch live tunnel token from Cloudflare
  let tunnelToken: string
  try {
    tunnelToken = await getTunnelToken(tenant.tunnelId)
  } catch (e: any) {
    return NextResponse.json({ error: `Could not fetch tunnel token: ${e.message}` }, { status: 502 })
  }

  // Read the base installer script
  const scriptPath = join(process.cwd(), 'scripts', 'Install-BespoxAI.ps1')
  let script: string
  try {
    script = readFileSync(scriptPath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'Installer script not found on server' }, { status: 500 })
  }

  // Inject tenant-specific defaults into the param block
  // Replaces the mandatory params with pre-filled defaults so IT just runs it
  const tenantSlug = tenant.tunnelSubdomain.replace(/[^a-z0-9]/gi, '')
  const header = `# Pre-configured installer for: ${tenant.name}
# Tenant: ${tenant.tunnelSubdomain} | BC: ${tenant.bcInstance} / ${tenant.bcCompany}
# Generated: ${new Date().toISOString()}
# 
# Run as Administrator:
#   .\\Install-BespoxAI-${tenantSlug}.ps1 -BCUsername "DOMAIN\\user" -BCPassword "password"
#
# All BespoxAI credentials are pre-filled. Only BC credentials are required.

`

  const configured = script
    .replace(
      '[Parameter(Mandatory)][string]  $TunnelToken,',
      `[string] $TunnelToken = '${tunnelToken}',`
    )
    .replace(
      '[Parameter(Mandatory)][string]  $ApiKey,',
      `[string] $ApiKey = '${tenant.apiKey}',`
    )
    .replace(
      "[string] $BCInstance  = 'BC',",
      `[string] $BCInstance  = '${tenant.bcInstance}',`
    )
    .replace(
      "[string] $BCCompany   = 'CRONUS International Ltd.',",
      `[string] $BCCompany   = '${tenant.bcCompany}',`
    )

  const filename = `Install-BespoxAI-${tenantSlug}.ps1`
  const finalScript = header + configured

  return new NextResponse(finalScript, {
    status: 200,
    headers: {
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
