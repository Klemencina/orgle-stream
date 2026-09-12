import type { PrismaClient } from '@prisma/client'

export async function hasFestivalPass(db: PrismaClient, userId: string, concertId: string) {
  return Boolean(await db.festivalPass.findFirst({
    where: { userId, status: 'paid', group: { concerts: { some: { id: concertId } } } },
    select: { id: true },
  }))
}

export async function hasConcertAccess(db: PrismaClient, userId: string, concert: { id: string }) {
  const ticket = await db.ticket.findUnique({ where: { userId_concertId: { userId, concertId: concert.id } }, select: { status: true } })
  return ticket?.status === 'paid' || await hasFestivalPass(db, userId, concert.id)
}
