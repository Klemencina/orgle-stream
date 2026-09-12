import type { PrismaClient } from '@prisma/client'

export class GroupError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function parseGroup(input: unknown) {
  if (!input || typeof input !== 'object') throw new GroupError('Invalid group')
  const body = input as Record<string, unknown>
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 160) throw new GroupError('Enter a group name of up to 160 characters')
  if (typeof body.salesEnabled !== 'boolean') throw new GroupError('Choose whether sales are enabled')
  if (!Array.isArray(body.concertIds) || body.concertIds.length > 500 || body.concertIds.some(id => typeof id !== 'string' || !id.trim())) throw new GroupError('Select valid concerts')
  if (body.stripePriceId != null && typeof body.stripePriceId !== 'string') throw new GroupError('Invalid Stripe Price ID')
  const stripePriceId = (body.stripePriceId as string | undefined)?.trim() || null
  if (stripePriceId && !/^price_[A-Za-z0-9_]+$/.test(stripePriceId)) throw new GroupError('Stripe Price ID must start with price_')
  const concertIds = [...new Set(body.concertIds as string[])]
  if (body.salesEnabled && (!stripePriceId || !concertIds.length)) throw new GroupError('Select concerts and a Stripe price before enabling sales')
  return { name: body.name.trim(), salesEnabled: body.salesEnabled, stripePriceId, concertIds }
}

export async function saveConcertGroup(db: PrismaClient, input: ReturnType<typeof parseGroup>, id?: string) {
  return db.$transaction(async tx => {
    if (id) await tx.$queryRaw`SELECT id FROM concert_groups WHERE id = ${id} FOR UPDATE`
    const existing = id ? await tx.concertGroup.findUnique({ where: { id }, include: { concerts: { select: { id: true } }, _count: { select: { passes: true } } } }) : null
    if (id && !existing) throw new GroupError('Group not found', 404)
    if (existing?._count.passes && existing.concerts.some(c => !input.concertIds.includes(c.id))) {
      throw new GroupError('Concerts cannot be removed after checkout has started. You can add concerts or stop new sales.', 409)
    }
    if (await tx.concert.count({ where: { id: { in: input.concertIds } } }) !== input.concertIds.length) throw new GroupError('One or more concerts no longer exist')
    if (input.salesEnabled && !await tx.concert.findFirst({ where: { id: { in: input.concertIds }, isVisible: true } })) throw new GroupError('Publish at least one selected concert before enabling sales')
    const data = { name: input.name, stripePriceId: input.stripePriceId, salesEnabled: input.salesEnabled }
    return id
      ? tx.concertGroup.update({ where: { id }, data: { ...data, concerts: { set: input.concertIds.map(id => ({ id })) } } })
      : tx.concertGroup.create({ data: { ...data, concerts: { connect: input.concertIds.map(id => ({ id })) } } })
  })
}
