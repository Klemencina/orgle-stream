import assert from 'node:assert/strict'
import test from 'node:test'
import { startPurchaseCheck, type PurchaseCheck } from '../src/lib/purchase-check'

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('a failed ticket lookup does not invite an existing customer to buy again', async () => {
  const states: PurchaseCheck[] = []
  const stop = startPurchaseCheck({ concertId: 'concert', returning: false, onState: s => states.push(s), fetcher: async () => new Response(null, { status: 500 }) })
  await flush()
  assert.deepEqual(states.at(-1), { purchased: null, status: 'error' })
  stop()
})

test('checkout confirmation retries sequentially and stops when the ticket is paid', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const states: PurchaseCheck[] = []
  let calls = 0
  const stop = startPurchaseCheck({ concertId: 'concert', sessionId: 'session&value', returning: true, onState: s => states.push(s), fetcher: async url => {
    assert.equal(new URL(String(url), 'https://example.test').searchParams.get('sessionId'), 'session&value')
    return Response.json({ purchased: ++calls === 2 })
  } })
  await flush()
  assert.equal(calls, 1)
  t.mock.timers.tick(1000)
  await flush()
  assert.deepEqual(states.at(-1), { purchased: true, status: 'idle' })
  t.mock.timers.tick(60_000)
  assert.equal(calls, 2)
  stop()
})

test('delayed payment has a bounded retry budget and never becomes a purchase prompt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const states: PurchaseCheck[] = []
  let calls = 0
  const stop = startPurchaseCheck({ concertId: 'concert', returning: true, onState: s => states.push(s), fetcher: async () => {
    calls++
    return Response.json({ purchased: false })
  } })
  await flush()
  for (let i = 1; i <= 5; i++) {
    t.mock.timers.tick(i * 1000)
    await flush()
  }
  assert.equal(calls, 6)
  assert.deepEqual(states.at(-1), { purchased: null, status: 'pending' })
  assert.equal(states.some(s => s.purchased === false), false)
  t.mock.timers.tick(60_000)
  assert.equal(calls, 6)
  stop()
})

test('switching accounts cancels a lookup and ignores its late response', async () => {
  const states: PurchaseCheck[] = []
  let finish!: (response: Response) => void
  let signal: AbortSignal | undefined | null
  const stop = startPurchaseCheck({ concertId: 'concert', returning: true, onState: s => states.push(s), fetcher: async (_url, init) => {
    signal = init?.signal
    return new Promise<Response>(resolve => { finish = resolve })
  } })
  stop()
  assert.equal(signal?.aborted, true)
  finish(Response.json({ purchased: true }))
  await flush()
  assert.deepEqual(states, [{ purchased: null, status: 'checking' }])
})

test('a checkout from another account stops verification without offering another purchase', async () => {
  const states: PurchaseCheck[] = []
  const stop = startPurchaseCheck({ concertId: 'concert', returning: true, onState: s => states.push(s), fetcher: async () => Response.json({ purchased: false, mismatch: true }) })
  await flush()
  assert.deepEqual(states.at(-1), { purchased: null, status: 'error' })
  stop()
})

test('a hung lookup times out and lets the viewer retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const states: PurchaseCheck[] = []
  const stop = startPurchaseCheck({ concertId: 'concert', returning: false, onState: s => states.push(s), fetcher: async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  }) })
  t.mock.timers.tick(10_000)
  await flush()
  assert.deepEqual(states.at(-1), { purchased: null, status: 'error' })
  stop()
})

test('leaving during the retry delay cancels further requests', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const stop = startPurchaseCheck({ concertId: 'concert', returning: true, onState: () => {}, fetcher: async () => {
    calls++
    return Response.json({ purchased: false })
  } })
  await flush()
  stop()
  t.mock.timers.tick(60_000)
  await flush()
  assert.equal(calls, 1)
})

test('an existing individual ticket does not stop waiting for a new pass payment', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const states: PurchaseCheck[] = []
  let calls = 0
  const stop = startPurchaseCheck({ concertId: 'concert', returning: true, onState: s => states.push(s), fetcher: async () => Response.json({ purchased: true, checkoutPending: ++calls < 2 }) })
  await flush()
  assert.deepEqual(states.at(-1), { purchased: true, status: 'checking' })
  t.mock.timers.tick(1000)
  await flush()
  assert.deepEqual(states.at(-1), { purchased: true, status: 'idle' })
  stop()
})
