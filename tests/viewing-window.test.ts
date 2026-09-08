import assert from 'node:assert/strict'
import test from 'node:test'
import { getTicketDateFilter, getViewingWindow } from '../src/lib/viewing-window'

test('a purchased concert remains current until its viewing window ends', () => {
  const start = new Date('2026-09-08T18:00:00Z')
  const end = start.getTime() + 3 * 60 * 60 * 1000
  for (const now of [start.getTime() - 60_000, start.getTime(), end - 1, end, end + 1]) {
    const upcoming = getTicketDateFilter('upcoming', now)!
    const past = getTicketDateFilter('past', now)!
    assert.equal(start >= upcoming.gte!, now <= end)
    assert.equal(start < past.lt!, now > end)
    if (now >= start.getTime()) {
      assert.equal(start >= upcoming.gte!, getViewingWindow(start, now).windowOpen)
    }
  }
  assert.equal(getTicketDateFilter('all', end), undefined)
})
