import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseObjectFile } from '@/lib/bc-object-parser'

export const dynamic = 'force-dynamic'

// ── GET /api/requirements/[id]/objects ────────────────────────────────────────
// Returns all parsed object records for this requirement.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any

  const requirement = await (prisma as any).requirement.findUnique({
    where: { id: params.id },
    select: { tenantId: true },
  })
  if (!requirement) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'superadmin' && requirement.tenantId !== user.tenantId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const objects = await (prisma as any).tenantObjectFile.findMany({
    where:   { requirementId: params.id },
    select:  {
      id: true, filename: true, objectType: true, objectId: true,
      objectName: true, language: true, summary: true, parseError: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
    orderBy: { uploadedAt: 'asc' },
  })

  return NextResponse.json({ objects })
}

// ── POST /api/requirements/[id]/objects ───────────────────────────────────────
// Accepts multipart/form-data with one or more files (field name: "files").
// Parses each file, splits C/AL multi-object exports, stores summaries.
// Superadmin only.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const requirement = await (prisma as any).requirement.findUnique({
    where:  { id: params.id },
    select: { tenantId: true, status: true },
  })
  if (!requirement) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (!files || files.length === 0)
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const created: any[] = []

  for (const file of files) {
    let content: string
    try {
      content = await file.text()
    } catch {
      // Unreadable file — store a parse-error record
      const rec = await (prisma as any).tenantObjectFile.create({
        data: {
          tenantId:      requirement.tenantId,
          requirementId: params.id,
          filename:      file.name,
          objectType:    'Unknown',
          objectId:      null,
          objectName:    file.name,
          language:      'AL',
          summary:       {},
          parseError:    true,
          uploadedById:  user.id,
        },
        select: {
          id: true, filename: true, objectType: true, objectId: true,
          objectName: true, language: true, summary: true, parseError: true,
          uploadedAt: true,
        },
      })
      created.push(rec)
      continue
    }

    // Parse — may return multiple objects for C/AL files
    const parsed = parseObjectFile(content, file.name)

    for (const p of parsed) {
      const rec = await (prisma as any).tenantObjectFile.create({
        data: {
          tenantId:      requirement.tenantId,
          requirementId: params.id,
          filename:      p.filename,
          objectType:    p.objectType,
          objectId:      p.objectId,
          objectName:    p.objectName,
          language:      p.language,
          summary:       p.summary,
          parseError:    p.parseError,
          uploadedById:  user.id,
        },
        select: {
          id: true, filename: true, objectType: true, objectId: true,
          objectName: true, language: true, summary: true, parseError: true,
          uploadedAt: true,
          uploadedBy: { select: { name: true, email: true } },
        },
      })
      created.push(rec)
    }
  }

  // Return the full updated list for this requirement
  const objects = await (prisma as any).tenantObjectFile.findMany({
    where:   { requirementId: params.id },
    select:  {
      id: true, filename: true, objectType: true, objectId: true,
      objectName: true, language: true, summary: true, parseError: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
    orderBy: { uploadedAt: 'asc' },
  })

  return NextResponse.json({ objects, created: created.length })
}
