import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/auth'
import { parseReportUpdate } from '@/lib/support-report'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function json(body: unknown, options: { status?: number } = {}) {
  return NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

export async function GET(request: NextRequest) {
  try {
    const ok = await isAdmin()
    if (!ok) return json({ error: 'Admin access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    if (status && status !== 'open' && status !== 'resolved') {
      return json({ error: 'Invalid report status' }, { status: 400 })
    }

    const reports = await prisma.supportReport.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    })

    return json({ items: reports })
  } catch (error) {
    console.error('List reports error:', error)
    return json({ error: 'Failed to list reports' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ok = await isAdmin()
    if (!ok) return json({ error: 'Admin access required' }, { status: 403 })

    const update = parseReportUpdate(await request.json().catch(() => null))
    if (!update) return json({ error: 'Valid id and status required' }, { status: 400 })

    const updated = await prisma.supportReport.update({ where: { id: update.id }, data: update.data })
    return json({ ok: true, item: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return json({ error: 'Report not found' }, { status: 404 })
    }
    console.error('Update report error:', error)
    return json({ error: 'Failed to update report' }, { status: 500 })
  }
}


