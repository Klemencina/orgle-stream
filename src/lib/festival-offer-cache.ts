import { createBrowserCache } from './browser-cache';

type OwnedOffer = { groupId: string; name: string; owned: true };
export type PurchasableOffer = {
  groupId: string; name: string; owned: false; amountCents: number; currency: string;
  individualTotalCents?: number | null; concertId: string;
  concerts: Array<{ id: string; date: string; title: string; subtitle?: string | null }>;
};
export type FestivalOffer = OwnedOffer | PurchasableOffer;

export function parseFestivalOffers(value: unknown): FestivalOffer[] {
  if (!Array.isArray(value)) throw new Error('Invalid festival offers');
  return value.map(offer => {
    if (!offer || typeof offer.groupId !== 'string' || typeof offer.name !== 'string' || typeof offer.owned !== 'boolean') throw new Error('Invalid festival offer');
    if (offer.owned) return { groupId: offer.groupId, name: offer.name, owned: true };
    if (!Number.isSafeInteger(offer.amountCents) || offer.amountCents < 0 || !/^[a-z]{3}$/i.test(offer.currency) ||
      typeof offer.concertId !== 'string' || !Array.isArray(offer.concerts) ||
      (offer.individualTotalCents != null && (!Number.isSafeInteger(offer.individualTotalCents) || offer.individualTotalCents < 0)) ||
      offer.concerts.some((concert: Record<string, unknown>) => !concert || typeof concert.id !== 'string' || typeof concert.title !== 'string' ||
        typeof concert.date !== 'string' || !Number.isFinite(Date.parse(concert.date)) || (concert.subtitle != null && typeof concert.subtitle !== 'string'))) throw new Error('Invalid festival price');
    return { groupId: offer.groupId, name: offer.name, owned: false, amountCents: offer.amountCents,
      currency: offer.currency, individualTotalCents: offer.individualTotalCents, concertId: offer.concertId,
      concerts: offer.concerts.map((concert: PurchasableOffer['concerts'][number]) => ({ id: concert.id, title: concert.title, subtitle: concert.subtitle, date: concert.date })),
    };
  });
}

export const festivalOfferKey = (locale: string, userId: string | null, concertId?: string) => JSON.stringify([locale, userId, concertId || null]);

// Account-specific display data only. Checkout and playback always verify access on the server.
export const festivalOfferCache = createBrowserCache({
  prefix: 'orgle:festival-offers:v1:',
  storage: () => typeof window === 'undefined' ? null : window.sessionStorage,
  parseData: parseFestivalOffers,
  loadData: async key => {
    const [locale, , concertId] = JSON.parse(key) as [string, string | null, string | null];
    const query = new URLSearchParams({ locale });
    if (concertId) query.set('concertId', concertId);
    const response = await fetch(`/api/festival-pass?${query}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load festival offers');
    return (await response.json()).offers;
  },
});
