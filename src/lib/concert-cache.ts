import type { LocalizedConcert } from '@/types/concert';

import { createBrowserCache, type CacheStorage } from './browser-cache';

function parseConcerts(value: unknown): LocalizedConcert[] {
  if (!Array.isArray(value)) throw new Error('Invalid concert list');
  return value.map(concert => {
    if (!concert || typeof concert !== 'object' ||
      !['id', 'title', 'date', 'venue', 'description', 'createdAt', 'updatedAt'].every(key => typeof concert[key] === 'string') ||
      !Number.isFinite(Date.parse(concert.date)) || concert.isVisible !== true ||
      (concert.subtitle != null && typeof concert.subtitle !== 'string') ||
      !Array.isArray(concert.program) || concert.program.some((piece: Record<string, unknown>) =>
        !piece || typeof piece.id !== 'string' || typeof piece.title !== 'string' || typeof piece.composer !== 'string' || typeof piece.order !== 'number') ||
      (concert.groups != null && (!Array.isArray(concert.groups) || concert.groups.some((group: Record<string, unknown>) =>
        !group || typeof group.id !== 'string' || typeof group.name !== 'string')))) {
      throw new Error('Invalid public concert');
    }
    // Persist only public listing fields, never purchase, playback, or admin data.
    return {
      id: concert.id, title: concert.title, subtitle: concert.subtitle ?? undefined,
      date: concert.date, venue: concert.venue, description: concert.description,
      createdAt: concert.createdAt, updatedAt: concert.updatedAt, isVisible: true,
      groups: concert.groups?.map((group: { id: string; name: string }) => ({ id: group.id, name: group.name })),
      program: concert.program.map((piece: { id: string; title: string; composer: string; order: number }) => ({
        id: piece.id, title: piece.title, composer: piece.composer, order: piece.order,
      })),
    };
  });
}

export function upcomingConcerts(concerts: LocalizedConcert[], now = Date.now()) {
  return concerts.filter(concert => Date.parse(concert.date) > now - 3 * 60 * 60_000);
}

export function createConcertCache({ storage, fetcher, now }: {
  storage: () => CacheStorage | null; fetcher: typeof fetch; now?: () => number;
}) {
  return createBrowserCache({
    storage, now, prefix: 'orgle:public-concerts:v1:', parseData: parseConcerts,
    loadData: async locale => {
      const response = await fetcher(`/api/concerts?locale=${encodeURIComponent(locale)}`, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch concerts');
      return response.json();
    },
  });
}

export const concertCache = createConcertCache({
  storage: () => typeof window === 'undefined' ? null : window.localStorage,
  fetcher: (...args) => fetch(...args),
});
