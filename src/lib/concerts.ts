import type { Prisma, PrismaClient } from '@prisma/client'

export async function replaceConcertDetails<T>(db: PrismaClient, concertId: string, save: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.programPiece.deleteMany({ where: { concertId } })
    await tx.concertTranslation.deleteMany({ where: { concertId } })
    return save(tx)
  })
}

export function archiveConcert(db: PrismaClient, id: string) {
  return db.concert.update({ where: { id }, data: { isVisible: false } })
}
