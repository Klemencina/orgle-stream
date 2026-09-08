import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSupportReport, REPORT_MESSAGE_LIMIT } from '../src/lib/support-report'

const valid = { email: 'viewer@example.com', concertId: 'concert', type: 'access' }

test('accepts reports from viewers without requiring a paid ticket or account', () => {
  const result = parseSupportReport({ ...valid, email: ' viewer@example.com ', message: ' Help with playback ', purchased: false })
  assert.ok(result.data)
  assert.equal(result.data.email, valid.email)
  assert.equal(result.data.message, 'Help with playback')
  assert.equal(result.data.purchased, false)
})

test('rejects malformed input without coercing objects into stored text', () => {
  for (const input of [null, [], 'report', {}, { ...valid, email: {} }, { ...valid, message: {} }, { ...valid, type: 'unknown' }, { ...valid, concertId: [] }]) {
    assert.ok('error' in parseSupportReport(input))
  }
})

test('checks reply addresses and bounds report length', () => {
  for (const email of ['@example.com', 'viewer@', 'viewer name@example.com', 'viewer@example.com\nother@example.com', 'x'.repeat(255) + '@example.com']) {
    assert.deepEqual(parseSupportReport({ ...valid, email }), { error: 'invalid_email' })
  }
  assert.ok('data' in parseSupportReport({ ...valid, message: 'x'.repeat(REPORT_MESSAGE_LIMIT) }))
  assert.ok('error' in parseSupportReport({ ...valid, message: 'x'.repeat(REPORT_MESSAGE_LIMIT + 1) }))
})

test('keeps missing diagnostic flags unknown and does not treat string false as true', () => {
  const result = parseSupportReport({ ...valid, isLive: 'false', everLive: false, windowOpen: true, locale: {} })
  assert.ok(result.data)
  assert.equal(result.data.isLive, null)
  assert.equal(result.data.purchased, null)
  assert.equal(result.data.everLive, false)
  assert.equal(result.data.windowOpen, true)
  assert.equal(result.data.locale, undefined)
})

test('resolving sets the completion time and reopening clears it', async () => {
  const { parseReportUpdate } = await import('../src/lib/support-report')
  const now = new Date('2026-09-08T18:00:00Z')
  assert.deepEqual(parseReportUpdate({ id: 'case', status: 'resolved' }, now), { id: 'case', data: { status: 'resolved', resolvedAt: now } })
  assert.deepEqual(parseReportUpdate({ id: 'case', status: 'open' }, now), { id: 'case', data: { status: 'open', resolvedAt: null } })
  for (const input of [null, [], {}, { id: {}, status: 'open' }, { id: 'case', status: 'deleted' }, { id: ' ', status: 'open' }]) {
    assert.equal(parseReportUpdate(input), null)
  }
})
