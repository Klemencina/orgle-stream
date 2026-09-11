import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { getStreamResponse, getViewingWindow, probePlayback } from '../src/lib/stream-access'

const now = 1_800_000_000_000
function fixture(overrides: Partial<Parameters<typeof getStreamResponse>[0]> = {}, ticketStatus = 'paid') {
  return {
    db: {
      concert: { findUnique: async () => ({ id: 'concert', date: new Date(now) }) },
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

test('admin preview waits for the scheduled start and closes at the end of the viewing window', async () => {
  let probes = 0
  for (const time of [now - 1, now - 86400000, now + 3 * 60 * 60 * 1000 + 1]) {
    for (const checkOnly of [false, true]) {
      const response = await getStreamResponse(fixture({
        now: time, adminPreview: true, isAdmin: async () => true, checkOnly,
        checkAvailability: async () => { probes++; return true },
      }, 'pending'))
      const body = await response.json()
      assert.equal(response.status, checkOnly ? 200 : 403)
      assert.equal(body.playbackUrl, undefined)
      if (checkOnly) assert.equal(body.available, false)
      else assert.equal(body.code, 'outsideWindow')
    }
  }
  assert.equal(probes, 0)
})

test('admin preview can watch during the concert without a paid ticket', async () => {
  for (const time of [now, now + 3 * 60 * 60 * 1000]) {
    const response = await getStreamResponse(fixture({ now: time, adminPreview: true, isAdmin: async () => true }, 'pending'))
    assert.equal(response.status, 200)
  }
  assert.equal((await getStreamResponse(fixture({ adminPreview: true }))).status, 403)
})

test('admin preview reports an offline stream as unavailable during the concert', async () => {
  const response = await getStreamResponse(fixture({ adminPreview: true, isAdmin: async () => true, checkOnly: true, checkAvailability: async () => false }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).available, false)
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
