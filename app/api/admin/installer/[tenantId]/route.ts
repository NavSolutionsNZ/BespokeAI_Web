import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTunnelToken } from '@/lib/cloudflare'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (!tenant.tunnelId)
    return NextResponse.json({ error: 'Tenant was not auto-provisioned — no tunnel ID stored.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { bcUsername = '', bcPassword = '', bcPort = 8048, agentPort = 8080 } = body

  if (!bcUsername) return NextResponse.json({ error: 'bcUsername is required' }, { status: 400 })

  let tunnelToken: string
  try {
    tunnelToken = await getTunnelToken(tenant.tunnelId)
  } catch (e: any) {
    return NextResponse.json({ error: `Could not fetch tunnel token: ${e.message}` }, { status: 502 })
  }

  const scriptPath = join(process.cwd(), 'scripts', 'Install-BespoxAI.ps1')
  let script: string
  try { script = readFileSync(scriptPath, 'utf-8') }
  catch { return NextResponse.json({ error: 'Installer script not found' }, { status: 500 }) }

  // Inject all credentials and settings
  const configured = script
    .replace('[Parameter(Mandatory)][string]  $TunnelToken,', `[string] $TunnelToken = '${tunnelToken}',`)
    .replace('[Parameter(Mandatory)][string]  $ApiKey,',      `[string] $ApiKey = '${tenant.apiKey}',`)
    .replace('[Parameter(Mandatory)][string]  $BCUsername,',  `[string] $BCUsername = '${bcUsername}',`)
    .replace('[Parameter(Mandatory)][string]  $BCPassword,',  `[string] $BCPassword = '${bcPassword}',`)
    .replace('[int]    $BCPort      = 8048,',                 `[int]    $BCPort      = ${bcPort},`)
    .replace("[string] $BCInstance  = 'BC',",                 `[string] $BCInstance  = '${tenant.bcInstance}',`)
    .replace("[string] $BCCompany   = 'CRONUS International Ltd.',", `[string] $BCCompany   = '${tenant.bcCompany}',`)
    .replace('[int]    $AgentPort   = 8080,',                 `[int]    $AgentPort   = ${agentPort},`)

  // Base64-encode the PS1
  const b64 = Buffer.from(configured, 'utf-8').toString('base64')

  // Split into 4000-char chunks safe for cmd.exe echo
  const chunks: string[] = []
  for (let i = 0; i < b64.length; i += 4000) chunks.push(b64.slice(i, i + 4000))

  const tenantSlug = tenant.tunnelSubdomain.replace(/[^a-z0-9]/gi, '')
  const tenantName = tenant.name

  const chunkLines = chunks.map(c => `echo ${c}`).join('\n')

  const bat = `@echo off
setlocal EnableDelayedExpansion
title BespoxAI Installer ^| ${tenantName}
color 0A

echo.
echo  ============================================================
echo    BespoxAI Installer
echo    Tenant: ${tenantName}
echo    BC:     ${tenant.bcInstance} / ${tenant.bcCompany}
echo  ============================================================
echo.

:: Check for Administrator rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  Requesting Administrator privileges...
    echo  Please click Yes on the UAC prompt.
    echo.
    powershell -NoProfile -Command "Start-Process -FilePath '%%~f0' -Verb RunAs"
    exit /b
)

echo  Running as Administrator. Starting installation...
echo.

:: Write base64-encoded installer to temp file
set "_tmp=%TEMP%\\bespoxai_%RANDOM%.b64"
set "_ps1=%TEMP%\\bespoxai_%RANDOM%.ps1"

(
${chunkLines}
) > "!_tmp!"

:: Decode and write PS1
powershell -NoProfile -Command "$b=(Get-Content '!_tmp!')-join'';$s=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b));[System.IO.File]::WriteAllText('!_ps1!',$s,[System.Text.Encoding]::UTF8);Remove-Item '!_tmp!'"

:: Run installer
powershell -NoProfile -ExecutionPolicy Bypass -File "!_ps1!"
set "_exit=%errorlevel%"

:: Cleanup
powershell -NoProfile -Command "Remove-Item '!_ps1!' -ErrorAction SilentlyContinue"

echo.
if %_exit% equ 0 (
    echo  ============================================================
    echo    Installation complete!
    echo  ============================================================
) else (
    echo  ============================================================
    echo    Installation encountered errors. See messages above.
    echo  ============================================================
)
echo.
pause
exit /b %_exit%
`

  return new NextResponse(bat, {
    status: 200,
    headers: {
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="Install-BespoxAI-${tenantSlug}.bat"`,
    },
  })
}

export async function GET() {
  return NextResponse.json({ message: 'POST with { bcUsername, bcPassword, bcPort?, agentPort? } to generate installer.' })
}
