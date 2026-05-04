import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyName, country, bcVersion, email } = body

  if (!companyName || !email) {
    return NextResponse.json({ error: 'Company name and email are required' }, { status: 400 })
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  // Check for duplicate pending signup
  const existing = await prisma.signupRequest.findFirst({
    where: { email, activatedAt: null },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A signup request for this email is already pending' },
      { status: 409 }
    )
  }

  // Generate secure verify token
  const verifyToken = crypto.randomBytes(32).toString('hex')

  await prisma.signupRequest.create({
    data: {
      companyName,
      country:   country   ?? 'NZ',
      bcVersion: bcVersion ?? 'BC25',
      email,
      verifyToken,
    },
  })

  await sendVerificationEmail(email, companyName, verifyToken)

  return NextResponse.json({ ok: true })
}
