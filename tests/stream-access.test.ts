import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { getStreamResponse, getViewingWindow, probePlayback } from '../src/lib/stream-access'

const now = 1_800_000_000_000
function fixture(overrides: Partial<Parameters<typeof getStreamResponse>[0]> = {}, ticketStatus = 'paid') {
  return {
    db: {
      concert: { findUnique: async () => ({ id: 'concert', date: new Date(now) }) },
      festivalPass: { findUnique: async () => null },
      ticket: { findUnique: async () => ({ status: ticketStatus }) },
    } as unknown as PrismaClient,
    concertId: 'concert', checkOnly: false, adminPreview: false,
    getUserId: async () => 'user', isAdmin: async () => false,
    playbackUrl: 'https://example.com/live.m3u8', checkAvailability: async () => true, now,
    ...overrides,
  }
}

test('only authenticated purchasers receive playback URLs', async () => {
  const unsigned = await getStreamResponse(fixture({ getUserId: async () => null }))
  assert.equal(unsigned.status, 401)
  for (const status of ['pending', 'failed', 'refunded']) {
    const response = await getStreamResponse(fixture({}, status))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).playbackUrl, undefined)
  }
  const paid = await getStreamResponse(fixture())
  assert.equal(paid.status, 200)
  assert.equal(paid.headers.get('cache-control'), 'private, no-store')
  assert.equal((await paid.json()).playbackUrl, 'https://example.com/live.m3u8')
})

test('public status does not expose playback URLs', async () => {
  const response = await getStreamResponse(fixture({ checkOnly: true, getUserId: async () => null }))
  const body = await response.json()
  assert.equal(body.available, true)
  assert.equal(body.playbackUrl, undefined)
})

test('viewing window blocks ordinary viewers while admin preview permits rehearsal', async () => {
  assert.equal((await getStreamResponse(fixture({ now: now + 86400000 }))).status, 403)
  assert.equal((await getStreamResponse(fixture({ now: now + 86400000, adminPreview: true }))).status, 403)
  const response = await getStreamResponse(fixture({ now: now + 86400000, adminPreview: true, isAdmin: async () => true }, 'pending'))
  assert.equal(response.status, 200)
})

test('hidden concerts are only queried by a verified admin preview', async () => {
  const requested: boolean[] = []
  const f = fixture()
  f.db.concert.findUnique = (async (args: { where: { isVisible?: boolean } }) => {
    requested.push(args.where.isVisible === true)
    return args.where.isVisible ? null : { id: 'concert', date: new Date(now) }
  }) as unknown as typeof f.db.concert.findUnique
  assert.equal((await getStreamResponse(f)).status, 404)
  assert.equal((await getStreamResponse({ ...f, adminPreview: true, isAdmin: async () => true })).status, 200)
  assert.deepEqual(requested, [true, false])
})

test('missing stream configuration returns an explicit error', async () => {
  const response = await getStreamResponse(fixture({ playbackUrl: undefined }))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'notConfigured')
})

test('viewing window includes its boundaries', () => {
  const date = new Date(now)
  const { windowStart, windowEnd } = getViewingWindow(date)
  assert.equal(getViewingWindow(date, windowStart).windowOpen, true)
  assert.equal(getViewingWindow(date, windowEnd).windowOpen, true)
  assert.equal(getViewingWindow(date, windowStart - 1).windowOpen, false)
  assert.equal(getViewingWindow(date, windowEnd + 1).windowOpen, false)
})

test('availability probes accept HLS and reject errors or malformed responses', async () => {
  assert.equal(await probePlayback('https://example.com/live.m3u8', async () => new Response('#EXTM3U\n', { headers: { 'content-type': 'application/x-mpegURL' } })), true)
  for (const response of [new Response('Offline', { status: 404 }), new Response('<html>Error</html>'), new Response('Not HLS', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } })]) {
    assert.equal(await probePlayback('https://example.com/live.m3u8', async () => response), false)
  }
  assert.equal(await probePlayback(undefined), false)
})
