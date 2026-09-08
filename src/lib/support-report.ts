export const REPORT_EMAIL_LIMIT = 254
export const REPORT_MESSAGE_LIMIT = 5000

export function parseSupportReport(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid_report' } as const
  const body = input as Record<string, unknown>
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || email.length > REPORT_EMAIL_LIMIT || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'invalid_email' } as const
  }
  const concertId = typeof body.concertId === 'string' ? body.concertId.trim() : ''
  if (!concertId || concertId.length > 128) return { error: 'missing_concert' } as const
  const type = body.type ?? 'access'
  if (typeof type !== 'string' || !['access', 'quality', 'payment', 'other'].includes(type)) {
    return { error: 'invalid_report' } as const
  }
  if (body.message != null && (typeof body.message !== 'string' || body.message.length > REPORT_MESSAGE_LIMIT)) {
    return { error: 'invalid_report' } as const
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const locale = typeof body.locale === 'string' && ['sl', 'en', 'it'].includes(body.locale) ? body.locale : undefined
  const flag = (key: string) => typeof body[key] === 'boolean' ? body[key] : null
  return { data: {
    email, concertId, type, message: message || undefined, locale,
    isLive: flag('isLive'), everLive: flag('everLive'), windowOpen: flag('windowOpen'), purchased: flag('purchased'),
  } } as const
}
