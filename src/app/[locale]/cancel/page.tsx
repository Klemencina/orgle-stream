'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LocalizedConcert } from '@/types/concert';

export default function CancelPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'sl';
  const concertId = searchParams?.get('concertId');
  const t = useTranslations('checkout');
  
  const [concert, setConcert] = useState<LocalizedConcert | null>(null);

  useEffect(() => {
    if (concertId) {
      fetch(`/api/concerts/${concertId}`)
        .then(res => res.json())
        .then(data => setConcert(data))
        .catch(() => {});
    }
  }, [concertId]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('cancel.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('cancel.description')}
            </p>
          </div>

          {concert && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {concert.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(concert.date).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              href={concertId ? `/${locale}/concerts/${concertId}` : `/${locale}/concerts`}
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {concertId ? t('cancel.tryAgain') : t('cancel.browseConcerts')}
            </Link>
            <div>
              <Link
                href={`/${locale}/concerts`}
                className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 text-sm"
              >
                {t('cancel.backToConcerts')}
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('cancel.helpText')} <a href="mailto:admin@orglekoper.si" className="text-orange-500 hover:text-orange-600">admin@orglekoper.si</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
