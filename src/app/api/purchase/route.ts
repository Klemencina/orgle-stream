import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckout } from '@/lib/tickets'

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

        // Harden verification: ensure the session belongs to this user and concert
        const metadata = (session.metadata ?? {}) as Record<string, string>
        const sessionUserId = metadata.userId
        const sessionConcertId = metadata.concertId
        const isOwner = Boolean(sessionUserId && sessionUserId === userId)
        const isSameConcert = Boolean(sessionConcertId && sessionConcertId === concertId)

        if (!isOwner || !isSameConcert) {
          // Do not mark as paid if the session doesn't match the authenticated user and concert
          return NextResponse.json({ purchased: false, mismatch: true })
        }
        await fulfillCheckout(prisma, session)
      } catch (err) {
        console.error('Session verify failed:', err)
      }
    }

    const ticket = await prisma.ticket.findUnique({ where: { userId_concertId: { userId, concertId } } })
    return NextResponse.json({ purchased: Boolean(ticket && ticket.status === 'paid') })
  } catch (error) {
    console.error('Purchase check error:', error)
    return NextResponse.json({ error: 'Failed to check purchase' }, { status: 500 })
  }
}


