import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

// Check purchase state for a concert for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(request.url)
    const concertId = searchParams.get('concertId') || ''
    const sessionId = searchParams.get('sessionId') || ''
    if (!concertId) {
      return NextResponse.json({ error: 'concertId required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ purchased: false, requiresAuth: true })
    }

    // If sessionId is provided, verify session with Stripe and mark paid if needed
    if (sessionId) {
      try {
        const stripe = getStripe()
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        const paid = session.payment_status === 'paid' || session.status === 'complete'
        if (paid) {
          const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0
          const currency = (session.currency as string | undefined) || 'eur'
          const existing = await (prisma as any).ticket.findUnique({ where: { userId_concertId: { userId, concertId } } })
          if (!existing) {
            await (prisma as any).ticket.create({
              data: {
                userId,
                concertId,
                amountCents: amountTotal || 0,
                currency,
                status: 'paid',
                stripePaymentIntentId: (session.payment_intent as string | null) || undefined,
                stripeCheckoutSessionId: session.id,
              }
            })
          } else if (existing.status !== 'paid') {
            await (prisma as any).ticket.update({
              where: { id: existing.id },
              data: {
                amountCents: amountTotal || existing.amountCents,
                currency,
                status: 'paid',
                stripePaymentIntentId: (session.payment_intent as string | null) || existing.stripePaymentIntentId,
                stripeCheckoutSessionId: session.id,
              }
            })
          }
        }
      } catch (err) {
        console.error('Session verify failed:', err)
      }
    }

    const ticket = await (prisma as any).ticket.findUnique({ where: { userId_concertId: { userId, concertId } } })
    return NextResponse.json({ purchased: Boolean(ticket && ticket.status === 'paid') })
  } catch (error) {
    console.error('Purchase check error:', error)
    return NextResponse.json({ error: 'Failed to check purchase' }, { status: 500 })
  }
}


