import type Stripe from 'stripe'
import type { PrismaClient } from '@prisma/client'

export function isSettledCheckout(session: Stripe.Checkout.Session) {
  return session.mode === 'payment' && session.status === 'complete' && (
    session.payment_status === 'paid' ||
    (session.payment_status === 'no_payment_required' && session.amount_total === 0)
  )
}

export async function fulfillCheckout(db: PrismaClient, session: Stripe.Checkout.Session) {
  const { userId, concertId } = session.metadata || {}
  if (!userId || !concertId || !isSettledCheckout(session)) return false

  const paymentIntent = session.payment_intent
  const stripePaymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id
  await db.$transaction(async (tx) => {
    await tx.ticket.upsert({
      where: { userId_concertId: { userId, concertId } },
      create: { userId, concertId, amountCents: 0, currency: session.currency || 'eur', status: 'pending' },
      update: { userId },
    })
    // A retry must not overwrite a paid ticket or restore revoked access.
    await tx.ticket.updateMany({
      where: { userId, concertId, status: { in: ['pending', 'failed', 'expired'] } },
      data: {
        status: 'paid',
        amountCents: session.amount_total ?? 0,
        currency: session.currency || 'eur',
        stripePaymentIntentId,
        stripeCheckoutSessionId: session.id,
      },
    })
  })
  return true
}

export async function closeUnpaidCheckout(db: PrismaClient, session: Stripe.Checkout.Session, status: 'failed' | 'expired') {
  await db.ticket.updateMany({
    where: { stripeCheckoutSessionId: session.id, status: 'pending' },
    data: { status },
  })
}
