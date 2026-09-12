'use client';

import { SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { getViewingWindow, VIEWING_DURATION_MS } from '@/lib/viewing-window';

type Ticket = {
  ticketId: string;
  passName: string | null;
  concertId: string;
  date: string;
  title: string;
  subtitle: string | null;
  venue: string;
  amountCents: number;
  currency: string;
  purchasedAt: string;
};

type Pass = { id: string; name: string; amountCents: number; currency: string; purchasedAt: string; concerts: Pick<Ticket, 'concertId' | 'date' | 'title' | 'subtitle' | 'venue'>[] };

export default function Dashboard() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { user } = useUser();
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{t('signIn')}</h1>
            <Link href={`/${locale}`} className="bg-orange-500 text-white px-4 py-2 rounded">
              {t('home')}
            </Link>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardContent key={`${user?.id}:${locale}`} />
      </SignedIn>
    </div>
  );
}

function DashboardContent() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/me/tickets/past?when=all&locale=${encodeURIComponent(locale)}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to load tickets');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setTickets(data.items);
          setPasses(data.passes || []);
          setNow(Date.now());
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [locale, attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = tickets.filter(ticket => new Date(ticket.date).getTime() + VIEWING_DURATION_MS >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = tickets.filter(ticket => new Date(ticket.date).getTime() + VIEWING_DURATION_MS < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const next = upcoming[0];
  const formatDate = (date: string) => new Date(date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana' });
  const formatPrice = (amount: number, currency: string) => (amount / 100).toLocaleString(locale, { style: 'currency', currency });

  function concertRow(item: Ticket, featured = false) {
    const window = getViewingWindow(new Date(item.date), now);
    return (
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="min-w-0 break-words">
          {item.passName && <p className="mb-1 text-sm font-medium text-orange-700 dark:text-orange-400">{item.passName}</p>}
          <h3 className={`${featured ? 'text-2xl' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>{item.title}</h3>
          {item.subtitle && <p className="mt-1 italic text-gray-600 dark:text-gray-300">{item.subtitle}</p>}
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{formatDate(item.date)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{item.venue}</p>
          {window.windowOpen && <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-300">{t('viewingAvailable')}</p>}
          {!item.passName && (
            <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer">{t('purchaseDetails')}</summary>
              <p className="mt-2">{t('purchased', { date: new Date(item.purchasedAt).toLocaleDateString(locale), amount: formatPrice(item.amountCents, item.currency) })}</p>
              <p className="mt-1 break-all">{t('ticketId', { id: item.ticketId })}</p>
            </details>
          )}
        </div>
        <Link href={`/${locale}/concerts/${item.concertId}`} className={`shrink-0 rounded-lg px-4 py-3 font-semibold ${featured || window.windowOpen ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white'}`}>
          {t(window.windowOpen ? 'watchNow' : 'viewConcert')}
        </Link>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('timezone')}</p>
      {loading && <p className="mt-6" role="status">{t('loading')}</p>}
      {error && (
        <div className="mt-6" role="alert">
          <p className="text-red-600 dark:text-red-400">{t('error')}</p>
          <button onClick={() => setAttempt(value => value + 1)} className="mt-3 bg-orange-500 text-white px-4 py-2 rounded">{t('retry')}</button>
        </div>
      )}
      {!loading && !error && (
        <div className="mt-6 space-y-6">
          {next ? (
            <section className="rounded-xl border border-orange-200 bg-white p-6 dark:border-orange-900 dark:bg-gray-800">
              <h2 className="mb-4 text-sm font-semibold text-orange-700 dark:text-orange-400">{t(getViewingWindow(new Date(next.date), now).windowOpen ? 'availableNow' : 'nextConcert')}</h2>
              {concertRow(next, true)}
            </section>
          ) : (
            <section className="rounded-xl bg-white p-6 dark:bg-gray-800">
              <p className="text-gray-600 dark:text-gray-300">{t('noUpcoming')}</p>
              <Link href={`/${locale}/concerts`} className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600">{t('browseConcerts')}</Link>
            </section>
          )}
          {upcoming.length > 1 && (
            <section className="rounded-xl bg-white p-6 dark:bg-gray-800">
              <h2 className="mb-2 text-xl font-semibold">{t('upcoming')}</h2>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {upcoming.slice(1).map(item => <li key={item.ticketId} className="py-4">{concertRow(item)}</li>)}
              </ul>
            </section>
          )}
          {passes.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">{t('yourPasses')}</h2>
              <div className="space-y-4">
                {passes.map(pass => (
                  <article key={pass.id} className="rounded-xl bg-white p-6 dark:bg-gray-800">
                    <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-400">{pass.name}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('includedConcerts')}</p>
                    {pass.concerts.length ? (
                      <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                        {pass.concerts.map(concert => (
                          <li key={concert.concertId} className="py-3">
                            <Link href={`/${locale}/concerts/${concert.concertId}`} className="font-medium hover:underline break-words">{concert.title}</Link>
                            {concert.subtitle && <p className="text-sm italic text-gray-600 dark:text-gray-300">{concert.subtitle}</p>}
                            <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(concert.date)}{new Date(concert.date).getTime() + VIEWING_DURATION_MS < now && ` · ${t('ended')}`}</p>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('noPublishedConcerts')}</p>}
                    <details className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <summary className="cursor-pointer">{t('purchaseDetails')}</summary>
                      <p className="mt-2">{t('purchased', { date: new Date(pass.purchasedAt).toLocaleDateString(locale), amount: formatPrice(pass.amountCents, pass.currency) })}</p>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          )}
          <details className="rounded-xl bg-white p-6 dark:bg-gray-800">
            <summary className="cursor-pointer text-lg font-semibold">{t('past')} · {past.length}</summary>
            {past.length ? (
              <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {past.map(item => <li key={item.ticketId} className="py-4">{concertRow(item)}</li>)}
              </ul>
            ) : <p className="mt-3 text-gray-600 dark:text-gray-300">{t('noPast')}</p>}
          </details>
        </div>
      )}
    </main>
  );
}
