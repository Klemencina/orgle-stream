import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { parseSupportReport } from '@/lib/support-report'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const parsed = parseSupportReport(await request.json().catch(() => null))
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const concert = await prisma.concert.findUnique({ where: { id: parsed.data.concertId }, select: { id: true } })
    if (!concert) {
      return NextResponse.json({ error: 'missing_concert' }, { status: 400 })
    }

    const { userId } = await auth().catch(() => ({ userId: null as unknown as string | null }))

    const created = await prisma.supportReport.create({
      data: {
        ...parsed.data,
        userAgent: request.headers.get('user-agent')?.slice(0, 1024) || undefined,
        userId: userId || null,
        status: 'open',
      }
    })

    return NextResponse.json({ ok: true, caseId: created.id })
  } catch (error) {
    console.error('Support report error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}


