import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { festivalDates, festivalYear, getFestivalPassConfig } from '@/lib/festival-pass'
import { VIEWING_DURATION_MS } from '@/lib/viewing-window'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  const config = getFestivalPassConfig()
  if (!config) return json({ available: false })
  try {
    const concertId = request.nextUrl.searchParams.get('concertId')
    if (concertId) {
      const concert = await prisma.concert.findUnique({ where: { id: concertId }, select: { date: true, isVisible: true } })
      if (!concert?.isVisible || festivalYear(concert.date) !== config.year) return json({ available: false })
    }
    const locale = request.nextUrl.searchParams.get('locale') || 'sl'
    const concerts = await prisma.concert.findMany({
      where: { isVisible: true, date: festivalDates(config.year) }, orderBy: { date: 'asc' },
      select: { id: true, date: true, translations: { where: { locale }, select: { title: true } } },
    })
    const remaining = concerts.filter(c => c.date.getTime() + VIEWING_DURATION_MS >= Date.now())
    const { userId } = await auth()
    const pass = userId ? await prisma.festivalPass.findUnique({ where: { userId_year: { userId, year: config.year } } }) : null
    if (pass?.status === 'paid') return json({ available: true, year: config.year, owned: true })
    if (!remaining.length) return json({ available: false })
    const price = await getStripe().prices.retrieve(pass?.stripePriceId || config.priceId)
    if (!price.active || price.type !== 'one_time' || price.unit_amount == null) return json({ available: false })
    return json({
      available: true, year: config.year, owned: false, amountCents: price.unit_amount, currency: price.currency,
      concertId: concertId || remaining[0].id,
      concerts: concerts.map(c => ({ id: c.id, date: c.date, title: c.translations[0]?.title || '' })),
    })
  } catch (error) {
    console.error('Festival pass offer failed:', error)
    return json({ error: 'Festival pass unavailable' }, 503)
  }
}
