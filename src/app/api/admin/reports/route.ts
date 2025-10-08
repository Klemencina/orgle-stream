import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const ok = await isAdmin()
    if (!ok) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const reports = await prisma.supportReport.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items: reports })
  } catch (error) {
    console.error('List reports error:', error)
    return NextResponse.json({ error: 'Failed to list reports' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ok = await isAdmin()
    if (!ok) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const body = (await request.json().catch(() => ({}))) as Partial<{ id: string; status: string }>
    const id = (body.id || '').toString()
    const status = (body.status || '').toString()
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

    const data: { status: string; resolvedAt?: Date } = { status }
    if (status === 'resolved') {
      data.resolvedAt = new Date()
    }

    const updated = await prisma.supportReport.update({ where: { id }, data })
    return NextResponse.json({ ok: true, item: updated })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}


