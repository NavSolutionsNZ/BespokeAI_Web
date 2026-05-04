import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as any).role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const signups = await prisma.signupRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })
    console.log(`[signups] fetched ${signups.length} records`)
    return NextResponse.json({ signups })
  } catch (e: any) {
    console.error('[signups] DB error:', e.message)
    return NextResponse.json({ error: `DB error: ${e.message}` }, { status: 500 })
  }
}
