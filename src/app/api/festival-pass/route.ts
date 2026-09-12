import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { VIEWING_DURATION_MS } from '@/lib/viewing-window'
import { festivalOfferPriceId } from '@/lib/festival-checkout'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  try {
    const concertId = request.nextUrl.searchParams.get('concertId')
    const locale = request.nextUrl.searchParams.get('locale') || 'sl'
    const { userId } = await auth()
    const groups = await prisma.concertGroup.findMany({
      where: {
        OR: [{ salesEnabled: true }, ...(userId ? [{ passes: { some: { userId, status: 'paid' } } }] : [])],
        ...(concertId ? { concerts: { some: { id: concertId, isVisible: true } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        concerts: { where: { isVisible: true }, orderBy: { date: 'asc' }, include: { translations: { where: { locale } } } },
        passes: { where: { userId: userId || '' } },
      },
    })
    const offers = await Promise.all(groups.map(async group => {
      const pass = group.passes[0]
      const base = { groupId: group.id, name: group.name }
      if (pass?.status === 'paid') return { ...base, owned: true }
      const remaining = group.concerts.filter(c => c.date.getTime() + VIEWING_DURATION_MS >= Date.now())
      if (!group.salesEnabled || !group.stripePriceId || !remaining.length) return null
      // One invalid Stripe price must not hide other groups.
      try {
        const stripe = getStripe()
        const priceId = await festivalOfferPriceId(stripe, group.stripePriceId, pass)
        if (!priceId) return null
        const price = await stripe.prices.retrieve(priceId)
        if (!price.active || price.type !== 'one_time' || price.unit_amount == null) return null
        return {
          ...base, owned: false, amountCents: price.unit_amount, currency: price.currency,
          concertId: concertId || remaining[0].id,
          concerts: group.concerts.map(c => ({ id: c.id, date: c.date, title: c.translations[0]?.title || '' })),
        }
      } catch (error) {
        console.error('Group price unavailable:', group.id, error)
        return null
      }
    }))
    return json({ offers: offers.filter(Boolean) })
  } catch (error) {
    console.error('Group offers failed:', error)
    return json({ error: 'Pass offers unavailable' }, 503)
  }
}
