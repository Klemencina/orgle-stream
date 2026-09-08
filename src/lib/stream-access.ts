import type { PrismaClient } from '@prisma/client'

export function getViewingWindow(date: Date, now = Date.now()) {
  const windowStart = date.getTime() - 15 * 60 * 1000
  const windowEnd = date.getTime() + 3 * 60 * 60 * 1000
  return { windowStart, windowEnd, windowOpen: now >= windowStart && now <= windowEnd }
}

export async function getStreamResponse(options: {
  db: PrismaClient
  concertId: string
  checkOnly: boolean
  adminPreview: boolean
  getUserId: () => Promise<string | null>
  isAdmin: () => Promise<boolean>
  playbackUrl?: string
  checkAvailability: () => Promise<boolean>
  now?: number
}) {
  const { db, concertId, checkOnly, adminPreview, playbackUrl } = options
  const now = options.now ?? Date.now()
  const json = (body: unknown, status = 200) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  })
  const admin = adminPreview ? await options.isAdmin() : false
  if (adminPreview && !admin) return json({ error: 'Admin access required', code: 'forbidden' }, 403)
  const concert = await db.concert.findUnique({
    where: { id: concertId, ...(admin ? {} : { isVisible: true }) },
    select: { id: true, date: true },
  })
  if (!concert) return json({ error: 'Concert not found', code: 'notFound' }, 404)
  const window = getViewingWindow(concert.date, now)
  if (!window.windowOpen && !admin) {
    return checkOnly ? json({ available: false, now, ...window }) :
      json({ error: 'Stream not available at this time', code: 'outsideWindow' }, 403)
  }
  if (checkOnly) {
    return json({ available: await options.checkAvailability(), now, ...window, preview: admin })
  }
  const userId = await options.getUserId()
  if (!userId) return json({ error: 'Authentication required', code: 'signIn' }, 401)
  const ticket = await db.ticket.findUnique({
    where: { userId_concertId: { userId, concertId } }, select: { status: true },
  })
  if (ticket?.status !== 'paid' && !admin && !(await options.isAdmin())) {
    return json({ error: 'Purchase required', code: 'purchaseRequired' }, 403)
  }
  if (!playbackUrl) return json({ error: 'Stream is not configured', code: 'notConfigured' }, 503)
  return json({ playbackUrl })
}

export async function probePlayback(playbackUrl: string | undefined, fetcher: typeof fetch = fetch) {
  if (!playbackUrl) return false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetcher(playbackUrl, { cache: 'no-store', signal: controller.signal })
    if (!response.ok || !(response.headers.get('content-type') || '').toLowerCase().includes('mpegurl')) return false
    return (await response.text()).trimStart().startsWith('#EXTM3U')
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
