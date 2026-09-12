export const VIEWING_DURATION_MS = 3 * 60 * 60 * 1000

export function getViewingWindow(date: Date, now = Date.now(), { adminPreview = false }: { adminPreview?: boolean } = {}) {
  const windowStart = date.getTime() - (adminPreview ? 0 : 15 * 60 * 1000)
  const windowEnd = date.getTime() + VIEWING_DURATION_MS
  return { windowStart, windowEnd, windowOpen: now >= windowStart && now <= windowEnd }
}

export function getTicketDateFilter(when: string, now = Date.now()) {
  const cutoff = new Date(now - VIEWING_DURATION_MS)
  return when === 'past' ? { lt: cutoff } : when === 'upcoming' ? { gte: cutoff } : undefined
}
