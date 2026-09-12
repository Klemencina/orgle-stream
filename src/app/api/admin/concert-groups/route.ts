import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { GroupError, parseGroup, saveConcertGroup } from '@/lib/concert-groups'

export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(request: NextRequest) {
  if (!await isAdmin()) return json({ error: 'Admin access required' }, 403)
  try {
    const locale = request.nextUrl.searchParams.get('locale') || 'sl'
    const [groups, concerts] = await Promise.all([
      prisma.concertGroup.findMany({ orderBy: { createdAt: 'desc' }, include: { concerts: { select: { id: true } }, _count: { select: { passes: true } } } }),
      prisma.concert.findMany({ orderBy: { date: 'asc' }, include: { translations: true } }),
    ])
    return json({
      groups: groups.map(g => ({ id: g.id, name: g.name, stripePriceId: g.stripePriceId || '', salesEnabled: g.salesEnabled, concertIds: g.concerts.map(c => c.id), membershipLocked: g._count.passes > 0 })),
      concerts: concerts.map(c => ({ id: c.id, date: c.date, isVisible: c.isVisible, title: (c.translations.find(t => t.locale === locale) || c.translations[0])?.title || c.id })),
    })
  } catch (error) {
    console.error('Group list failed:', error)
    return json({ error: 'Could not load groups' }, 500)
  }
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return json({ error: 'Admin access required' }, 403)
  try {
    const body = await request.json().catch(() => null)
    const input = parseGroup(body)
    const id = body.id
    if (id !== undefined && (typeof id !== 'string' || !id.trim())) throw new GroupError('Invalid group ID')
    if (input.salesEnabled && input.stripePriceId) {
      let price
      try { price = await getStripe().prices.retrieve(input.stripePriceId) }
      catch { throw new GroupError('Could not verify this Stripe price. Check the Price ID and try again.') }
      if (!price.active || price.type !== 'one_time' || price.unit_amount == null) throw new GroupError('Use an active Stripe price with a fixed one-time amount')
    }
    const group = await saveConcertGroup(prisma, input, id)
    return json({ id: group.id })
  } catch (error) {
    if (error instanceof GroupError) return json({ error: error.message }, error.status)
    console.error('Group save failed:', error)
    return json({ error: 'Could not save group' }, 500)
  }
}
