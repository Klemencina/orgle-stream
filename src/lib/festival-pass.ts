import type { PrismaClient } from '@prisma/client'

export function festivalYear(date: Date) {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Ljubljana' }).format(date))
}

export function festivalDates(year: number) {
  // January boundaries in Slovenia use UTC+01:00.
  return { gte: new Date(`${year}-01-01T00:00:00+01:00`), lt: new Date(`${year + 1}-01-01T00:00:00+01:00`) }
}

export function getFestivalPassConfig(env: Record<string, string | undefined> = process.env) {
  const year = Number(env.FESTIVAL_PASS_YEAR)
  const priceId = env.FESTIVAL_PASS_STRIPE_PRICE_ID?.trim()
  if (!Number.isInteger(year) || year < 2026 || year > 2100 || !priceId?.startsWith('price_')) return null
  return { year, priceId }
}

export async function hasFestivalPass(db: PrismaClient, userId: string, date: Date) {
  const pass = await db.festivalPass.findUnique({ where: { userId_year: { userId, year: festivalYear(date) } }, select: { status: true } })
  return pass?.status === 'paid'
}

export async function hasConcertAccess(db: PrismaClient, userId: string, concert: { id: string; date: Date }) {
  const ticket = await db.ticket.findUnique({ where: { userId_concertId: { userId, concertId: concert.id } }, select: { status: true } })
  return ticket?.status === 'paid' || await hasFestivalPass(db, userId, concert.date)
}
