'use client';

import { SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Ticket = {
  ticketId: string;
  concertId: string;
  date: string;
  title: string;
  subtitle: string | null;
  venue: string;
  amountCents: number;
  currency: string;
  purchasedAt: string;
};

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
  const [tickets, setTickets] = useState<{ past: Ticket[]; upcoming: Ticket[] }>({ past: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const results = await Promise.all(['past', 'upcoming'].map(async when => {
          const response = await fetch(`/api/me/tickets/past?when=${when}&locale=${encodeURIComponent(locale)}`, {
            cache: 'no-store', signal: controller.signal,
          });
          if (!response.ok) throw new Error('Failed to load tickets');
          return response.json();
        }));
        if (!controller.signal.aborted) setTickets({ past: results[0].items, upcoming: results[1].items });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [locale, attempt]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {loading && <p className="mt-6" role="status">{t('loading')}</p>}
      {error && (
        <div className="mt-6" role="alert">
          <p className="text-red-600 dark:text-red-400">{t('error')}</p>
          <button onClick={() => setAttempt(value => value + 1)} className="mt-3 bg-orange-500 text-white px-4 py-2 rounded">
            {t('retry')}
          </button>
        </div>
      )}
      {!loading && !error && (['upcoming', 'past'] as const).map(section => (
        <section key={section} className="bg-white dark:bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">{t(section)}</h2>
          {tickets[section].length === 0 && <p className="text-gray-600 dark:text-gray-300">{t(section === 'past' ? 'noPast' : 'noUpcoming')}</p>}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {tickets[section].map(item => (
              <li key={item.ticketId} className="py-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{item.title}</div>
                  {item.subtitle && <div className="text-sm text-gray-600 dark:text-gray-300">{item.subtitle}</div>}
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {new Date(item.date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana' })} • {item.venue}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('timezone')}</p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('purchased', { date: new Date(item.purchasedAt).toLocaleDateString(locale), amount: (item.amountCents / 100).toLocaleString(locale, { style: 'currency', currency: item.currency.toUpperCase() }) })}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">{t('ticketId', { id: item.ticketId })}</div>
                </div>
                <Link href={`/${locale}/concerts/${item.concertId}`} className="shrink-0 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-2 rounded">
                  {t('viewConcert')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
