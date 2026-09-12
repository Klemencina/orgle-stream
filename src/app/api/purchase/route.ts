import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckout } from '@/lib/tickets'
import { hasConcertAccess } from '@/lib/festival-pass'

export const runtime = 'nodejs'

function json(body: unknown, options: { status?: number } = {}) {
  return NextResponse.json(body, { ...options, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

// Check purchase state for a concert for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(request.url)
    const concertId = searchParams.get('concertId') || ''
    const sessionId = searchParams.get('sessionId') || ''
    if (!concertId) {
      return json({ error: 'concertId required' }, { status: 400 })
    }

    if (!userId) {
      return json({ purchased: false, requiresAuth: true })
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId }, select: { id: true, date: true } })
    if (!concert) return json({ error: 'Concert not found' }, { status: 404 })

    let checkoutPending = Boolean(sessionId)

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
        const isSameConcert = metadata.purchaseType === 'festivalPass'
          ? Boolean(await prisma.festivalPass.findFirst({ where: { id: metadata.passId || '', userId, group: { concerts: { some: { id: concertId } } } } }))
          : Boolean(sessionConcertId && sessionConcertId === concertId)

        if (!isOwner || !isSameConcert) {
          // Do not mark as paid if the session doesn't match the authenticated user and concert
          return json({ purchased: false, mismatch: true })
        }
        await fulfillCheckout(prisma, session)
        checkoutPending = metadata.purchaseType === 'festivalPass'
          ? !Boolean(await prisma.festivalPass.findFirst({ where: { id: metadata.passId || '', userId, status: 'paid' } }))
          : !(await hasConcertAccess(prisma, userId, concert))
      } catch (err) {
        console.error('Session verify failed:', err)
      }
    }

    return json({ purchased: await hasConcertAccess(prisma, userId, concert), checkoutPending })
  } catch (error) {
    console.error('Purchase check error:', error)
    return json({ error: 'Failed to check purchase' }, { status: 500 })
  }
}


