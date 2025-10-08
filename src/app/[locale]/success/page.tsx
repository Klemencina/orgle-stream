'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LocalizedConcert } from '@/types/concert';

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'sl';
  const concertId = searchParams?.get('concertId');
  const t = useTranslations('checkout');
  
  const [concert, setConcert] = useState<LocalizedConcert | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (concertId) {
      fetch(`/api/concerts/${concertId}`)
        .then(res => res.json())
        .then(data => {
          setConcert(data);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [concertId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">{t('success.loading')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('success.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('success.description')}
            </p>
          </div>

          {concert && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">
                {concert.title}
              </h3>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  <strong>{t('success.date')}:</strong> {new Date(concert.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {concert.venue && (
                  <p>
                    <strong>{t('success.location')}:</strong> {concert.venue}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-left">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  {t('success.ticketInfo.title')}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t('success.ticketInfo.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href={concertId ? `/${locale}/concerts/${concertId}` : `/${locale}/concerts`}
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {concertId ? t('success.viewConcert') : t('success.browseConcerts')}
            </Link>
            <div>
              <Link
                href={`/${locale}/dashboard`}
                className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 text-sm"
              >
                {t('success.viewTickets')}
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('success.helpText')} <a href="mailto:admin@orglekoper.si" className="text-orange-500 hover:text-orange-600">admin@orglekoper.si</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
