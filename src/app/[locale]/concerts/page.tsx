'use client';

import Link from "next/link";
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LocalizedConcert } from '@/types/concert';

export default function ConcertsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [concerts, setConcerts] = useState<LocalizedConcert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    async function fetchConcerts() {
      try {
        const currentLocale = locale || 'en';
        const adminParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'true';
        setIsAdminView(Boolean(adminParam));
        const response = await fetch(`/api/concerts?locale=${currentLocale}${adminParam ? '&admin=true' : ''}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch concerts');
        }
        const data = await response.json();
        setConcerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (locale) {
      fetchConcerts();
    }
  }, [locale]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎹</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('concerts.loading')}</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('concerts.loadingError')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {t('concerts.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
                          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <span className="text-4xl">🎹</span>
              {t('concerts.title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('concerts.subtitle')}
            </p>
            </div>

          </div>
        </div>

        {/* Concerts Grid */}
        <div
          className={
            `grid gap-6 ` +
            (concerts.length === 1
              ? 'grid-cols-1 md:grid-cols-1 lg:grid-cols-1'
              : concerts.length === 2
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3')
          }
        >
          {concerts.map((concert) => (
            <div key={concert.id} className="w-full h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
              

              {/* Concert Details */}
              <div className="p-6 flex-1 flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 break-words whitespace-normal">
                  {concert.title}
                </h2>
                {concert.subtitle && (
                  <h3 className="text-lg text-gray-700 dark:text-gray-200 mb-2 break-words whitespace-normal">
                    {concert.subtitle}
                  </h3>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">📅</span>
                    <span className="text-sm">
                      {new Date(concert.date).toLocaleDateString(locale, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">🕒</span>
                    <span className="text-sm">
                      {new Date(concert.date).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">📍</span>
                    <span className="text-sm break-words whitespace-normal">{concert.venue}</span>
                  </div>

                </div>

                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3 break-words whitespace-normal">
                  {concert.description}
                </p>

                {/* Program Preview */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('concerts.programHighlights')}:</h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {concert.program.slice(0, 2).map((piece) => (
                      <li key={piece.id} className="flex items-center break-words whitespace-normal">
                        <span className="mr-2">♪</span>
                        {piece.title}
                      </li>
                    ))}
                    {concert.program.length > 2 && (
                      <li className="text-gray-500">+{concert.program.length - 2} {t('concerts.morePieces')}</li>
                    )}
                  </ul>
                </div>

                {/* View Concert Button */}
                <Link href={`/${locale}/concerts/${concert.id}${isAdminView ? '?admin=true' : ''}`}>
                  <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg">
                    {t('concerts.viewDetails')}
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        
      </div>
    </div>
  );
}
