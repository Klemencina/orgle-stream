import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { CheckoutError, createCheckout } from '@/lib/checkout'
import { createFestivalCheckout } from '@/lib/festival-checkout'
import { getFestivalPassConfig } from '@/lib/festival-pass'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const body = await request.json().catch(() => null)
    if (!body || typeof body.concertId !== 'string' || !body.concertId.trim()) {
      return NextResponse.json({ error: 'concertId is required' }, { status: 400 })
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required')
    const locale = ['sl', 'en', 'it'].includes(body.locale) ? body.locale : 'sl'
    if (body.purchaseType && !['concert', 'festivalPass'].includes(body.purchaseType)) {
      return NextResponse.json({ error: 'Invalid purchase type' }, { status: 400 })
    }
    if (body.purchaseType === 'festivalPass') {
      const config = getFestivalPassConfig()
      if (!config || body.year !== config.year) return NextResponse.json({ error: 'Festival pass unavailable' }, { status: 400 })
      return NextResponse.json(await createFestivalCheckout(prisma, getStripe(), { userId, concertId: body.concertId, locale, appUrl }, config))
    }
    return NextResponse.json(await createCheckout(prisma, getStripe(), {
      userId, concertId: body.concertId, locale, appUrl,
    }))
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Checkout create error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
