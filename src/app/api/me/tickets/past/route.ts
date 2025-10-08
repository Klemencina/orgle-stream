import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locale = (searchParams.get('locale') || 'en').toLowerCase()
    const when = (searchParams.get('when') || 'all').toLowerCase() as 'past' | 'upcoming' | 'all'

    const now = new Date()
    const dateFilter = when === 'past' ? { lt: now } : when === 'upcoming' ? { gte: now } : undefined
    const tickets = await prisma.ticket.findMany({
      where: { userId, status: 'paid', ...(dateFilter ? { concert: { date: dateFilter } } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        stripePaymentIntentId: true,
        stripeCheckoutSessionId: true,
        amountCents: true,
        currency: true,
        createdAt: true,
        concert: {
          select: {
            id: true,
            date: true,
            translations: {
              where: { locale: locale },
              select: { title: true, subtitle: true, venue: true, description: true }
            }
          }
        }
      }
    })

    const items = tickets.map((t) => {
      const tr = t.concert.translations[0]
      return {
        ticketId: t.id,
        stripePaymentIntentId: t.stripePaymentIntentId || null,
        stripeCheckoutSessionId: t.stripeCheckoutSessionId || null,
        concertId: t.concert.id,
        date: t.concert.date,
        title: tr?.title || '',
        subtitle: tr?.subtitle || null,
        venue: tr?.venue || '',
        amountCents: t.amountCents,
        currency: t.currency,
        purchasedAt: t.createdAt,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('List past tickets error:', error)
    return NextResponse.json({ error: 'Failed to list past tickets' }, { status: 500 })
  }
}


