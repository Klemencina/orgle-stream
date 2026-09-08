import { test } from 'node:test'
import assert from 'node:assert/strict'
import type Hls from 'hls.js'
import { startPlayback, PlaybackAccessError, type PlaybackState } from '../src/lib/playback-controller'

const flush = () => new Promise<void>(resolve => setImmediate(resolve))
class Video extends EventTarget {
  src = ''
  paused = true
  error: object | null = null
  plays = 0
  blocked = false
  native = true
  canPlayType() { return this.native ? 'maybe' : '' }
  removeAttribute() { this.src = '' }
  load() { this.error = null }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
  async play() {
    this.plays++
    if (this.blocked) throw new DOMException('Autoplay blocked', 'NotAllowedError')
    this.paused = false
    this.dispatchEvent(new Event('playing'))
  }
  fail() { this.error = {}; this.dispatchEvent(new Event('error')) }
}
function setup(video = new Video(), getAccess: (signal: AbortSignal) => Promise<{ playbackUrl: string }> = async () => ({ playbackUrl: 'https://example.com/live.m3u8' })) {
  const states: PlaybackState[] = []
  const controller = startPlayback(video as unknown as HTMLVideoElement, {
    getAccess, onState: state => states.push(state),
    loadHls: async () => { throw new Error('Native playback should not load HLS') },
  })
  return { video, states, controller }
}

test('cleanup cancels pending access and ignores its eventual result', async () => {
  let resolve!: (value: { playbackUrl: string }) => void
  let signal!: AbortSignal
  const f = setup(new Video(), async s => { signal = s; return new Promise(r => { resolve = r }) })
  f.controller.dispose()
  const count = f.states.length
  resolve({ playbackUrl: 'https://example.com/stale.m3u8' })
  await flush()
  assert.equal(signal.aborted, true)
  assert.equal(f.video.src, '')
  assert.equal(f.states.length, count)
})

test('setup can restart after Strict Mode cleanup without reviving the old source', async () => {
  const video = new Video()
  const first = setup(video)
  first.controller.dispose()
  const second = setup(video, async () => ({ playbackUrl: 'https://example.com/second.m3u8' }))
  await flush()
  assert.equal(video.src, 'https://example.com/second.m3u8')
  video.dispatchEvent(new Event('canplay'))
  await flush()
  assert.equal(video.plays, 1)
  second.controller.dispose()
})

test('autoplay refusal offers manual playback without reconnecting', async () => {
  const video = new Video()
  video.blocked = true
  const f = setup(video)
  await flush()
  video.dispatchEvent(new Event('canplay'))
  await flush()
  assert.equal(f.states.at(-1)?.status, 'ready')
  video.blocked = false
  await f.controller.play()
  assert.equal(f.states.at(-1)?.status, 'playing')
  f.controller.dispose()
})

test('native errors reconnect using fresh authorization and stop retrying after disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let requests = 0
  const f = setup(new Video(), async () => ({ playbackUrl: `https://example.com/live.m3u8?attempt=${++requests}` }))
  await flush()
  f.video.fail()
  assert.equal(f.states.at(-1)?.status, 'reconnecting')
  t.mock.timers.tick(2000)
  await flush()
  assert.equal(requests, 2)
  assert.match(f.video.src, /attempt=2/)
  f.video.fail()
  f.controller.dispose()
  t.mock.timers.tick(60000)
  await flush()
  assert.equal(requests, 2)
})

test('permanent access errors stop automatically retrying', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let requests = 0
  const f = setup(new Video(), async () => { requests++; throw new PlaybackAccessError('purchaseRequired') })
  await flush()
  assert.deepEqual(f.states.at(-1), { status: 'error', error: 'purchaseRequired' })
  t.mock.timers.tick(60000)
  await flush()
  assert.equal(requests, 1)
  f.controller.dispose()
})

test('network recovery has a finite retry budget and manual retry resets it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let requests = 0
  const f = setup(new Video(), async () => { requests++; throw new Error('Offline') })
  await flush()
  for (let i = 0; i < 6; i++) { t.mock.timers.tick(15000); await flush() }
  assert.equal(requests, 6)
  assert.deepEqual(f.states.at(-1), { status: 'error', error: 'connection' })
  f.controller.retry()
  await flush()
  assert.equal(requests, 7)
  f.controller.dispose()
})

test('a stalled access request is aborted before retrying', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal!: AbortSignal
  const f = setup(new Video(), async s => { signal = s; return new Promise(() => {}) })
  t.mock.timers.tick(20000)
  assert.equal(signal.aborted, true)
  assert.equal(f.states.at(-1)?.status, 'reconnecting')
  f.controller.dispose()
})

test('late HLS imports do not create a player after disposal', async () => {
  const video = new Video()
  video.native = false
  let resolve!: (value: typeof Hls) => void
  let created = 0
  class FakeHls { static isSupported() { return true }; constructor() { created++ } }
  const controller = startPlayback(video as unknown as HTMLVideoElement, {
    getAccess: async () => ({ playbackUrl: 'https://example.com/live.m3u8' }),
    loadHls: () => new Promise(r => { resolve = r }), onState: () => {},
  })
  await flush()
  controller.dispose()
  resolve(FakeHls as unknown as typeof Hls)
  await flush()
  assert.equal(created, 0)
})

test('repeated buffering events cannot postpone recovery indefinitely', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = setup()
  await flush()
  f.video.dispatchEvent(new Event('canplay'))
  await flush()
  for (let i = 0; i < 4; i++) {
    f.video.dispatchEvent(new Event('waiting'))
    t.mock.timers.tick(5000)
  }
  assert.equal(f.states.at(-1)?.status, 'reconnecting')
  f.controller.dispose()
})

test('fatal HLS errors destroy the old instance before reconnecting', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const video = new Video()
  video.native = false
  let destroyed = 0
  let created = 0
  let fail!: () => void
  class FakeHls {
    static Events = { ERROR: 'error' }
    static isSupported() { return true }
    constructor() { created++ }
    on(_event: string, handler: (event: string, data: { fatal: boolean }) => void) { fail = () => handler('error', { fatal: true }) }
    attachMedia() {}
    loadSource() {}
    destroy() { destroyed++ }
  }
  const controller = startPlayback(video as unknown as HTMLVideoElement, {
    getAccess: async () => ({ playbackUrl: 'https://example.com/live.m3u8' }),
    loadHls: async () => FakeHls as unknown as typeof Hls, onState: () => {},
  })
  await flush()
  fail()
  assert.equal(destroyed, 1)
  t.mock.timers.tick(2000)
  await flush()
  assert.equal(created, 2)
  controller.dispose()
  assert.equal(destroyed, 2)
})
