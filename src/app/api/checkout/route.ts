import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { concertId, successUrl, cancelUrl } = body as { concertId?: string; successUrl?: string; cancelUrl?: string }
    if (!concertId) {
      return NextResponse.json({ error: 'concertId is required' }, { status: 400 })
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } })
    if (!concert || !concert.isVisible) {
      return NextResponse.json({ error: 'Concert not found' }, { status: 404 })
    }

    // Check if user already owns a ticket
    const existing = await prisma.ticket.findUnique({ where: { userId_concertId: { userId, concertId } } })
    if (existing && existing.status === 'paid') {
      return NextResponse.json({ alreadyOwned: true })
    }

    const stripe = getStripe()
    const priceId = concert.stripePriceId
    const productId = concert.stripeProductId

    if (!priceId) {
      return NextResponse.json({ error: 'Concert is not purchasable yet' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/success?concertId=${concertId}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cancel?concertId=${concertId}`,
      metadata: {
        concertId,
        userId,
        productId: productId || '',
      },
    })

    // Optionally create a pending ticket record to avoid duplicates
    if (!existing) {
      await prisma.ticket.create({
        data: {
          userId,
          concertId,
          amountCents: 0,
          currency: 'eur',
          status: 'pending',
          stripeCheckoutSessionId: session.id,
        },
      })
    } else if (existing.status !== 'paid') {
      await prisma.ticket.update({
        where: { id: existing.id },
        data: { stripeCheckoutSessionId: session.id, status: 'pending' },
      })
    }

    return NextResponse.json({ id: session.id, url: session.url })
  } catch (error) {
    console.error('Checkout create error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}


