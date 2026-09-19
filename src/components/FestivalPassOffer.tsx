'use client';

import { useLayoutEffect, useState } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

import { festivalOfferCache, festivalOfferKey, type FestivalOffer as Offer } from '@/lib/festival-offer-cache';

function OfferPlaceholder({ horizontal = false }: { horizontal?: boolean }) {
  const t = useTranslations('festivalPass');
  return <div role="status" aria-label={t('loading')} className={`min-h-72 w-full rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800 ${horizontal ? 'mb-6 md:min-h-36' : ''}`}>
    <div aria-hidden="true" className={`motion-safe:animate-pulse space-y-4 ${horizontal ? 'md:space-y-3' : ''}`}>
      <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-8 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  </div>;
}

export default function FestivalPassOffer(props: { concertId?: string; refreshKey?: string; horizontal?: boolean }) {
  const { user, isLoaded } = useUser();
  const locale = useLocale();
  if (!isLoaded) return <OfferPlaceholder horizontal={props.horizontal} />;
  return <OfferContent key={`${locale}:${user?.id || 'guest'}:${props.concertId || ''}:${props.refreshKey}`} {...props} userId={user?.id || null} />;
}

function OfferContent({ concertId, userId, refreshKey, horizontal = false }: { concertId?: string; userId: string | null; refreshKey?: string; horizontal?: boolean }) {
  const locale = useLocale();
  const key = festivalOfferKey(locale, userId, concertId);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  useLayoutEffect(() => {
    let active = true;
    setOffers(festivalOfferCache.read(key));
    void festivalOfferCache.load(key, refreshKey !== undefined)
      .then(data => { if (active) setOffers(data); })
      .catch(() => { if (active) setOffers(previous => previous ?? []); });
    return () => { active = false; };
  }, [key, refreshKey]);
  if (offers === null) return <OfferPlaceholder horizontal={horizontal} />;
  return <>{offers.map(offer => <GroupOffer key={offer.groupId} offer={offer} signedIn={!!userId} horizontal={horizontal} />)}</>;
}

function GroupOffer({ offer, signedIn, horizontal }: { offer: Offer; signedIn: boolean; horizontal: boolean }) {
  const t = useTranslations('festivalPass');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const width = horizontal ? 'w-full mb-6' : 'w-full';
  if (offer.owned) return <div className={`${width} rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20`} role="status">{t('owned', { name: offer.name })}</div>;
  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: 'currency', currency: offer.currency });
  const savings = offer.individualTotalCents != null ? offer.individualTotalCents - offer.amountCents : 0;
  const discount = savings > 0 && offer.individualTotalCents ? Math.floor(savings / offer.individualTotalCents * 100) : 0;

  async function buy() {
    if (busy || offer.owned) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseType: 'festivalPass', groupId: offer.groupId, concertId: offer.concertId, locale }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Checkout unavailable');
      if (data.alreadyOwned) { window.location.reload(); return; }
      if (typeof data.url !== 'string') throw new Error('Checkout unavailable');
      window.location.assign(data.url);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <section className={`${width} min-w-0 self-start overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-orange-500 dark:bg-gray-800`}>
      <div className={`p-6 ${horizontal ? 'md:grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-x-8' : ''}`}>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold text-orange-700 dark:text-orange-400">{offer.name}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">{t('concertCount', { count: offer.concerts.length })}</p>
        </div>
        <div className={horizontal ? 'mt-5 md:mt-0' : 'mt-5'}>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{money(offer.amountCents)}</span>
            {savings > 0 && <span className="text-lg text-gray-500 dark:text-gray-400"><span className="sr-only">{t('individualPrice')} </span><s>{money(offer.individualTotalCents!)}</s></span>}
          </div>
          {savings > 0 && <p className="mt-2 text-sm font-semibold text-orange-700 dark:text-orange-300">{t('save', { amount: money(savings) })}{discount > 0 && <span className="ml-2 font-normal">{t('discount', { percent: discount })}</span>}</p>}
        </div>
        <div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{t('error')}</p>}
          {signedIn ? (
            <button type="button" disabled={busy} onClick={() => void buy()} className={`mt-4 w-full rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 ${horizontal ? 'md:mt-0 md:w-auto' : ''}`}>{t(busy ? 'opening' : 'buy')}</button>
          ) : (
            <SignInButton mode="modal"><button type="button" className={`mt-4 w-full rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-orange-600 ${horizontal ? 'md:mt-0 md:w-auto' : ''}`}>{t('buy')}</button></SignInButton>
          )}
        </div>
        <details className="col-span-full mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer hover:text-orange-600 dark:hover:text-orange-400">{t('details')}</summary>
          <ul className="mt-3 space-y-3 text-sm">
            {offer.concerts.map(c => (
              <li key={c.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                <div className="min-w-0">
                  <Link href={`/${locale}/concerts/${c.id}`} className="break-words font-medium text-gray-900 hover:text-orange-600 dark:text-gray-100 dark:hover:text-orange-400">{c.title}{c.subtitle?.trim() ? `, ${c.subtitle.trim()}` : ''}</Link>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{new Date(c.date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana' })}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3">{t('liveOnly')}</p>
          <p className="mt-2">{t('noCredit')}</p>
        </details>
      </div>
    </section>
  );
}
