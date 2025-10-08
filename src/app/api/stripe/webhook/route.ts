import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event
  try {
    const payload = await request.text()
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const concertId = session?.metadata?.concertId as string | undefined
        const userId = session?.metadata?.userId as string | undefined
        if (!concertId || !userId) break

        const paymentIntentId = session.payment_intent as string | null
        const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0
        const currency = (session.currency as string | undefined) || 'eur'

        // Mark or create ticket as paid
        const existing = await prisma.ticket.findUnique({ where: { userId_concertId: { userId, concertId } } })
        if (!existing) {
          await prisma.ticket.create({
            data: {
              userId,
              concertId,
              amountCents: amountTotal || 0,
              currency,
              status: 'paid',
              stripePaymentIntentId: paymentIntentId || undefined,
              stripeCheckoutSessionId: session.id,
            },
          })
        } else {
          await prisma.ticket.update({
            where: { id: existing.id },
            data: {
              amountCents: amountTotal || existing.amountCents,
              currency,
              status: 'paid',
              stripePaymentIntentId: paymentIntentId || existing.stripePaymentIntentId,
              stripeCheckoutSessionId: session.id,
            },
          })
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err)
    return NextResponse.json({ received: true, error: 'handler_error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

export const config = {
  api: {
    bodyParser: false,
  },
}


