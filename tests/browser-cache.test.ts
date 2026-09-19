import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCache, type CacheStorage } from '../src/lib/browser-cache';
import { createConcertCache, upcomingConcerts } from '../src/lib/concert-cache';
import { festivalOfferKey, parseFestivalOffers } from '../src/lib/festival-offer-cache';

function storage(): CacheStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const parse = (value: unknown) => { if (typeof value !== 'string') throw Error('Invalid'); return value; };

test('preloading and navigation share one request, with fresh and stale reads', async () => {
  let now = 1000;
  let calls = 0;
  let finish!: (value: string) => void;
  const store = storage();
  const options = { storage: () => store, prefix: 'test:', parseData: parse, now: () => now, loadData: async () => { calls++; return new Promise<string>(resolve => { finish = resolve; }); } };
  const cache = createBrowserCache(options);
  const preload = cache.load('sl');
  assert.equal(cache.load('sl'), preload);
  finish('first');
  await preload;
  assert.equal(await cache.load('sl'), 'first');
  assert.equal(calls, 1);
  const reloaded = createBrowserCache(options);
  assert.equal(reloaded.read('sl'), 'first');
  assert.equal(reloaded.read('it'), null);
  now += 31_000;
  const refresh = cache.load('sl');
  assert.equal(cache.read('sl'), 'first');
  finish('updated');
  await refresh;
  assert.equal(cache.read('sl'), 'updated');
  now += 15 * 60_000;
  assert.equal(cache.read('sl'), null);
});

test('refresh failures retain cached data, can retry, and forced refresh bypasses freshness', async () => {
  let fail = false;
  let calls = 0;
  const cache = createBrowserCache({ storage: () => null, prefix: 'test:', parseData: parse,
    loadData: async () => { calls++; if (fail) throw Error('offline'); return 'ok'; } });
  await cache.load('user-a');
  fail = true;
  await assert.rejects(cache.load('user-a', true));
  assert.equal(cache.read('user-a'), 'ok');
  fail = false;
  await cache.load('user-a', true);
  assert.equal(calls, 3);
  assert.equal(cache.read('user-b'), null);
});

test('blocked storage and corrupt or future-dated entries do not break fetching', async () => {
  const store = storage();
  const options = { storage: () => store, prefix: 'test:', parseData: parse, now: () => 1000, loadData: async () => 'ok' };
  for (const raw of ['bad json', JSON.stringify({ savedAt: 1000, data: {} }), JSON.stringify({ savedAt: 9999, data: 'future' })]) {
    store.setItem('test:sl', raw);
    assert.equal(createBrowserCache(options).read('sl'), null);
  }
  const cache = createBrowserCache({ ...options, storage: () => { throw Error('disabled'); } });
  assert.equal(await cache.load('sl'), 'ok');
  assert.equal(cache.read('sl'), 'ok');
});

const concert = { id: 'one', title: 'Concert', date: '2026-10-11T18:00:00Z', venue: 'Koper', description: '', createdAt: '', updatedAt: '', isVisible: true, program: [] };
test('public cache requests and persists listing fields only', async () => {
  const store = storage();
  const cache = createConcertCache({ storage: () => store, fetcher: async (url, init) => {
    assert.equal(url, '/api/concerts?locale=sl');
    assert.equal(init?.credentials, 'omit');
    return Response.json([{ ...concert, purchased: true, playbackToken: 'private' }]);
  } });
  const data = await cache.load('sl');
  assert.equal('purchased' in data[0], false);
  assert.equal(store.getItem('orgle:public-concerts:v1:sl')?.includes('private'), false);
  const privateCache = createConcertCache({ storage: () => store, fetcher: async () => Response.json([{ ...concert, isVisible: false }]) });
  await assert.rejects(privateCache.load('it'));
});

test('cached concerts age out of the viewing window without a new response', () => {
  assert.equal(upcomingConcerts([concert], Date.parse(concert.date) + 2 * 3600_000).length, 1);
  assert.equal(upcomingConcerts([concert], Date.parse(concert.date) + 3 * 3600_000).length, 0);
});

test('festival cache separates accounts, languages and concert pages and validates prices', () => {
  assert.equal(new Set([festivalOfferKey('sl', null), festivalOfferKey('sl', 'a'), festivalOfferKey('sl', 'b'), festivalOfferKey('it', 'a'), festivalOfferKey('sl', 'a', 'concert')]).size, 5);
  assert.deepEqual(parseFestivalOffers([{ groupId: 'g', name: 'Festival', owned: true }]), [{ groupId: 'g', name: 'Festival', owned: true }]);
  assert.throws(() => parseFestivalOffers([{ groupId: 'g', name: 'Festival', owned: false, amountCents: '4000' }]));
  assert.deepEqual(parseFestivalOffers([]), []);
});
