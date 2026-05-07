import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId   = (session.user as any).id     as string
  const tenantId = (session.user as any).tenantId as string

  const body = await req.json().catch(() => ({}))
  const {
    persona,
    navProduct,
    navVersion,
    lastCU,
    bcPort,
    agentPort,
    wantsToConnect,
  } = body

  // Validate port numbers if provided
  const parsedBcPort    = parseInt(bcPort,    10)
  const parsedAgentPort = parseInt(agentPort, 10)
  const safeBcPort      = isNaN(parsedBcPort)    || parsedBcPort    < 1 || parsedBcPort    > 65535 ? 8048 : parsedBcPort
  const safeAgentPort   = isNaN(parsedAgentPort) || parsedAgentPort < 1 || parsedAgentPort > 65535 ? 8080 : parsedAgentPort

  // Save persona + mark onboarding done on User
  await prisma.user.update({
    where: { id: userId },
    data: {
      persona:       persona       ?? null,
      onboardingDone: true,
    },
  })

  // Save system info + port config on Tenant
  await (prisma as any).tenant.update({
    where: { id: tenantId },
    data: {
      ...(navProduct !== undefined && { navProduct }),
      ...(navVersion !== undefined && { navVersion }),
      ...(lastCU     !== undefined && { lastCU }),
      bcPort:    safeBcPort,
      agentPort: safeAgentPort,
    },
  })

  return NextResponse.json({ ok: true, wantsToConnect: !!wantsToConnect })
}
