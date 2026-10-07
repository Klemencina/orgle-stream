const CONCERT_TIME_ZONE = 'Europe/Ljubljana';

type ConcertDate = string | Date;

export function formatConcertDate(date: ConcertDate, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    timeZone: CONCERT_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatConcertTime(date: ConcertDate, locale: string): string {
  return new Date(date).toLocaleTimeString(locale, {
    timeZone: CONCERT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}

export function formatConcertDateTime(date: ConcertDate, locale: string): string {
  return new Date(date).toLocaleString(locale, {
    timeZone: CONCERT_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}
