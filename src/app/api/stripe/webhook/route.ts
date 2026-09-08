import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import type Stripe from 'stripe'
import { closeUnpaidCheckout, fulfillCheckout } from '@/lib/tickets'

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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        await fulfillCheckout(prisma, event.data.object as Stripe.Checkout.Session)
        break
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        await closeUnpaidCheckout(prisma, event.data.object as Stripe.Checkout.Session,
          event.type === 'checkout.session.expired' ? 'expired' : 'failed')
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

