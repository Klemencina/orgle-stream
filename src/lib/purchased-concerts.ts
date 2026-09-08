import type { PrismaClient } from '@prisma/client'
import { getTicketDateFilter } from './viewing-window'
import { festivalDates } from './festival-pass'

export async function listPurchasedConcerts(db: PrismaClient, userId: string, locale: string, when: string) {
  const dateFilter = getTicketDateFilter(when)
  const tickets = await db.ticket.findMany({
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
      passYear: null as number | null,
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

  const passes = await db.festivalPass.findMany({ where: { userId, status: 'paid' }, orderBy: { year: 'desc' } })
  const existing = new Set(items.map(item => item.concertId))
  for (const pass of passes) {
    const concerts = await db.concert.findMany({
      where: { isVisible: true, AND: [{ date: festivalDates(pass.year) }, ...(dateFilter ? [{ date: dateFilter }] : [])] },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, translations: { where: { locale }, select: { title: true, subtitle: true, venue: true } } },
    })
    for (const concert of concerts) {
      if (existing.has(concert.id)) continue
      const tr = concert.translations[0]
      items.push({
        ticketId: `pass:${pass.id}:${concert.id}`, passYear: pass.year,
        stripePaymentIntentId: null, stripeCheckoutSessionId: null,
        concertId: concert.id, date: concert.date, title: tr?.title || '', subtitle: tr?.subtitle || null, venue: tr?.venue || '',
        amountCents: 0, currency: pass.currency, purchasedAt: pass.createdAt,
      })
    }
  }
  items.sort((a, b) => when === 'past' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime())
  return { items, passes: passes.map(p => ({ id: p.id, year: p.year, amountCents: p.amountCents, currency: p.currency, purchasedAt: p.createdAt })) }
}
