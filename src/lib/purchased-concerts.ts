import { getGroupName } from './group-name'
import type { PrismaClient } from '@prisma/client'
import { getTicketDateFilter, VIEWING_DURATION_MS } from './viewing-window'

export async function listPurchasedConcerts(db: PrismaClient, userId: string, locale: string, when: string) {
  const now = Date.now()
  const dateFilter = getTicketDateFilter(when, now)
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
      passName: null as string | null,
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

  const passes = await db.festivalPass.findMany({
    where: { userId, status: 'paid' },
    orderBy: { createdAt: 'desc' },
    include: {
      group: {
        include: {
          concerts: {
            where: { isVisible: true },
            orderBy: { date: 'asc' },
            select: {
              id: true, date: true,
              translations: { where: { locale }, select: { title: true, subtitle: true, venue: true } },
            },
          },
        },
      },
    },
  })
  const existing = new Set(items.map(item => item.concertId))
  for (const pass of passes) {
    const cutoff = now - VIEWING_DURATION_MS
    const concerts = pass.group.concerts.filter(concert =>
      when === 'past' ? concert.date.getTime() < cutoff : when === 'upcoming' ? concert.date.getTime() >= cutoff : true
    )
    for (const concert of concerts) {
      if (existing.has(concert.id)) continue
      existing.add(concert.id)
      const tr = concert.translations[0]
      items.push({
        ticketId: `pass:${pass.id}:${concert.id}`, passName: getGroupName(pass.group, locale),
        stripePaymentIntentId: null, stripeCheckoutSessionId: null,
        concertId: concert.id, date: concert.date, title: tr?.title || '', subtitle: tr?.subtitle || null, venue: tr?.venue || '',
        amountCents: 0, currency: pass.currency, purchasedAt: pass.createdAt,
      })
    }
  }
  items.sort((a, b) => when === 'past' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime())
  return {
    items,
    passes: passes.map(pass => ({
      id: pass.id,
      name: getGroupName(pass.group, locale),
      amountCents: pass.amountCents,
      currency: pass.currency,
      purchasedAt: pass.createdAt,
      concerts: pass.group.concerts.map(concert => ({
        concertId: concert.id,
        date: concert.date,
        title: concert.translations[0]?.title || '',
        subtitle: concert.translations[0]?.subtitle || null,
        venue: concert.translations[0]?.venue || '',
      })),
    })),
  }
}
