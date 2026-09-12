'use client';

import { useEffect, useState } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';

type Offer = {
  groupId: string;
  name: string;
  owned: boolean;
  amountCents: number;
  currency: string;
  concertId: string;
  concerts: Array<{ id: string; date: string; title: string }>;
};

export default function FestivalPassOffer(props: { concertId?: string; refreshKey?: string }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  return <OfferContent key={`${user?.id || 'guest'}:${props.concertId || ''}:${props.refreshKey}`} {...props} signedIn={!!user} />;
}

function OfferContent({ concertId, signedIn }: { concertId?: string; signedIn: boolean }) {
  const locale = useLocale();
  const [offers, setOffers] = useState<Offer[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setOffers([]);
    const query = new URLSearchParams({ locale });
    if (concertId) query.set('concertId', concertId);
    void fetch(`/api/festival-pass?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => { if (res.ok) { const data = await res.json(); if (!controller.signal.aborted) setOffers(data.offers || []); } })
      .catch(() => {});
    return () => controller.abort();
  }, [concertId, locale]);
  return <>{offers.map(offer => <GroupOffer key={offer.groupId} offer={offer} signedIn={signedIn} />)}</>;
}

function GroupOffer({ offer, signedIn }: { offer: Offer; signedIn: boolean }) {
  const t = useTranslations('festivalPass');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (offer.owned) return <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 my-6" role="status">{t('owned', { name: offer.name })}</div>;

  async function buy() {
    if (busy || !offer) return;
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
    <section className="bg-orange-50 dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-xl p-6 my-6">
      <h2 className="text-xl font-bold">{offer.name}</h2>
      <p className="mt-2">{t('description')}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {offer.concerts.map(c => <li key={c.id}>{new Date(c.date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana' })} · {c.title}</li>)}
      </ul>
      <p className="mt-2 text-sm">{t('liveOnly')}</p>
      <p className="mt-4 text-xl font-semibold">{(offer.amountCents / 100).toLocaleString(locale, { style: 'currency', currency: offer.currency })}</p>
      <p className="mt-2 text-sm">{t('noCredit')}</p>
      {error && <p role="alert" className="mt-3 text-red-600 dark:text-red-400">{t('error')}</p>}
      {signedIn ? (
        <button type="button" disabled={busy} onClick={() => void buy()} className="mt-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white px-5 py-3 rounded-lg">{t(busy ? 'opening' : 'buy')}</button>
      ) : (
        <SignInButton mode="modal"><button type="button" className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg">{t('signIn')}</button></SignInButton>
      )}
    </section>
  );
}
