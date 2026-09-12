import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { listPurchasedConcerts } from '@/lib/purchased-concerts'

export const runtime = 'nodejs'

function json(body: unknown, options: { status?: number } = {}) {
  return NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locale = (searchParams.get('locale') || 'en').toLowerCase()
    const when = (searchParams.get('when') || 'all').toLowerCase() as 'past' | 'upcoming' | 'all'

    return json(await listPurchasedConcerts(prisma, userId, locale, when))
  } catch (error) {
    console.error('List past tickets error:', error)
    return json({ error: 'Failed to list past tickets' }, { status: 500 })
  }
}


