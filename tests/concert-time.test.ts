import assert from 'node:assert/strict';
import test from 'node:test';
import { formatConcertDate, formatConcertDateTime, formatConcertTime } from '../src/lib/concert-time';

test('concert times use Slovenian time and label the zone for visitors in any time zone', () => {
  const previousTimeZone = process.env.TZ;
  try {
    for (const visitorTimeZone of ['America/New_York', 'UTC', 'Asia/Tokyo']) {
      process.env.TZ = visitorTimeZone;
      for (const locale of ['en', 'sl', 'it']) {
        for (const date of ['2026-09-08T18:00:00Z', '2026-01-08T19:00:00Z']) {
          const time = formatConcertTime(date, locale);
          const dateTime = formatConcertDateTime(date, locale);
          assert.match(time, /^20:00\s+\S+/, `${locale}, ${date}, ${visitorTimeZone}`);
          assert.ok(dateTime.includes(time), `Pass details must include the same labeled time: ${dateTime}`);
        }
      }
    }
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

test('concert dates use the Slovenian calendar day across midnight and daylight saving changes', () => {
  for (const [date, expected] of [
    ['2026-09-08T22:30:00Z', 'Wednesday, September 9, 2026'],
    ['2026-01-08T23:30:00Z', 'Friday, January 9, 2026'],
    ['2026-03-29T00:30:00Z', 'Sunday, March 29, 2026'],
    ['2026-03-29T01:30:00Z', 'Sunday, March 29, 2026'],
  ]) {
    assert.equal(formatConcertDate(date, 'en'), expected);
  }
  assert.match(formatConcertTime('2026-03-29T00:30:00Z', 'en'), /^01:30\s+\S+/);
  assert.match(formatConcertTime('2026-03-29T01:30:00Z', 'en'), /^03:30\s+\S+/);
});
