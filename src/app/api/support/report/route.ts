import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as any
    const email = (body.email || '').toString().trim()
    const type = (body.type || 'access').toString()
    const message = (body.message || '').toString()
    const concertId = (body.concertId || '').toString()
    const locale = (body.locale || '').toString()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (!concertId) {
      return NextResponse.json({ error: 'missing_concert' }, { status: 400 })
    }

    const { userId } = await auth().catch(() => ({ userId: null as any }))

    const created = await (prisma as any).supportReport.create({
      data: {
        email,
        type,
        message: message || undefined,
        concertId,
        locale: locale || undefined,
        isLive: !!body.isLive,
        everLive: !!body.everLive,
        windowOpen: !!body.windowOpen,
        purchased: typeof body.purchased === 'boolean' ? body.purchased : null,
        userAgent: request.headers.get('user-agent') || undefined,
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


