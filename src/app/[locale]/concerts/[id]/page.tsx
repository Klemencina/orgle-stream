'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LocalizedConcert, ProgramPiece } from '@/types/concert';
import dynamic from 'next/dynamic';

// Define the dynamic component at module scope to avoid remounting on every render
const StreamPlayer = dynamic(() => import('@/components/StreamPlayer'), { ssr: false });

// Helper function for Slovenian pluralization
const getSlovenianPlural = (count: number, unitKey: string, t: ReturnType<typeof useTranslations>) => {
  // Slovenian plural rules:
  // 1 = one (singular)
  // 2-4 = few (paucal)
  // 5+ = many (plural)
  let form: string;
  if (count === 1) {
    form = 'one';
  } else if (count >= 2 && count <= 4) {
    form = 'few';
  } else {
    form = 'many';
  }

  const unitData = t.raw(`concert.${unitKey}`);
  return unitData?.[form] || unitData?.few || unitData || unitKey;
};

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function ConcertPage() {
  const params = useParams();
  const concertId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations();

  const [timeLeft, setTimeLeft] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLive, setIsLive] = useState(false);
  const [everLive, setEverLive] = useState(false);
  const [concert, setConcert] = useState<LocalizedConcert | null>(null);
  const [fullProgram, setFullProgram] = useState<ProgramPiece[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programView, setProgramView] = useState<'sl' | 'original'>('sl');

  useEffect(() => {
    async function fetchConcert() {
      try {
        const currentLocale = locale || 'en';
        const response = await fetch(`/api/concerts/${concertId}?locale=${currentLocale}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          if (response.status === 404) {
            setConcert(null);
          } else {
            throw new Error('Failed to fetch concert');
          }
        } else {
          const data = await response.json();
          setConcert(data);
        }
        // Also fetch full translations for program display (Slovenian + Original)
        const fullRes = await fetch(`/api/concerts/${concertId}?allTranslations=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          if (fullData && Array.isArray(fullData.program)) {
            setFullProgram(fullData.program);
            setProgramView(locale === 'sl' ? 'sl' : 'original');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (concertId && locale) {
      fetchConcert();
    }
  }, [concertId, locale]);

  useEffect(() => {
    if (!concert) return;

    const targetDate = new Date(concert.date).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [concert]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let aborted = false;
    async function checkServerAvailability() {
      if (!concert) return;
      try {
        const res = await fetch(`/api/concerts/${concert.id}?check=true`, { cache: 'no-store' });
        if (!res.ok) {
          if (!aborted && !everLive) setIsLive(false);
          return;
        }
        const data = await res.json();
        const available = Boolean(data?.available);
        if (!aborted) {
          console.log(`Stream availability check: isLive=${available}, everLive=${everLive}`);
          setIsLive(available);
          if (available) setEverLive(true);
        }
      } catch {
        if (!aborted) setIsLive(false);
      }
    }
    if (concert) {
      checkServerAvailability();
      interval = setInterval(checkServerAvailability, 15000);
    }
    return () => {
      aborted = true;
      if (interval) clearInterval(interval);
    };
  }, [concert, everLive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎹</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('concert.loadingConcert')}</h2>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('concert.loadingConcertError')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <Link href={`/${locale}/concerts`}>
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
              {t('concert.viewAllConcerts')}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!concert) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('concert.notFound')}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{t('concert.notFoundMessage')}</p>
          <Link href={`/${locale}/concerts`}>
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
              {t('concert.viewAllConcerts')}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Duration no longer displayed in the program

  // Compute stream window state
  const startTime = new Date(concert.date).getTime();
  const nowTs = Date.now();
  const windowStart = startTime - 15 * 60 * 1000;
  const windowEnd = startTime + 3 * 60 * 60 * 1000;
  const windowOpen = nowTs >= windowStart && nowTs <= windowEnd;
  const hasEnded = nowTs > windowEnd;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/${locale}/concerts`}>
            <button className="mb-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
              {t('concert.backToConcerts')}
            </button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {concert.performer}
          </h1>
          <div className="text-lg text-gray-600 dark:text-gray-300 mb-2">{concert.title}</div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Concert Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  {concert.description && concert.description.trim().length > 0 && (
                    <p className="text-gray-600 dark:text-gray-300 mb-4">{concert.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">📅</span>
                      <span className="text-base md:text-lg font-semibold">{new Date(concert.date).toLocaleDateString(locale, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">🕒</span>
                      <span className="text-base md:text-lg font-semibold">{new Date(concert.date).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">📍</span>
                      <span>{concert.venue}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                {isLive ? t('concert.liveNow') : t('concert.countdown')}
              </h3>

              {isLive || (everLive && windowOpen) ? (
                <div>
                  <div className="mb-4">
                    <StreamPlayer key={`stream-${concert.id}`} concertId={concert.id} />
                  </div>
                  <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                    {t('concert.watchLive')}
                  </div>
                </div>
              ) : hasEnded ? (
                <div className="p-6 text-center text-gray-700 dark:text-gray-200">
                  {t('concert.liveStreamEnded')}
                </div>
              ) : windowOpen ? (
                <div className="p-6 text-center text-gray-700 dark:text-gray-200">
                  {t('concert.waitingForStream')}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-orange-100 dark:bg-orange-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{timeLeft.days}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{getSlovenianPlural(timeLeft.days, 'days', t)}</div>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{timeLeft.hours}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{getSlovenianPlural(timeLeft.hours, 'hours', t)}</div>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{timeLeft.minutes}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{getSlovenianPlural(timeLeft.minutes, 'minutes', t)}</div>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{timeLeft.seconds}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{getSlovenianPlural(timeLeft.seconds, 'seconds', t)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Venue Details */}
            
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Concert Program */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🎼</span>
                  {t('concert.program')}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                    <button
                      className={`px-3 py-1 text-sm ${programView === 'sl' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
                      onClick={() => setProgramView('sl')}
                      type="button"
                    >
                      Slovensko
                    </button>
                    <button
                      className={`px-3 py-1 text-sm ${programView === 'original' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
                      onClick={() => setProgramView('original')}
                      type="button"
                    >
                      Original
                    </button>
                  </div>
                </div>
              </div>

              {/* Program list: show either Slovenian or Original based on user choice */}
              <div className="space-y-2">
                {(fullProgram ?? []).sort((a, b) => a.order - b.order).map((piece) => {
                  const sl = piece.translations.find(t => t.locale === 'sl') || null;
                  const original = piece.translations.find(t => t.locale === 'original') || null;
                  const chosen = programView === 'sl' ? sl : original;
                  const isIntermission = !chosen?.composer;
                  return (
                    <div key={piece.id} className={`py-2 px-3 rounded-lg ${
                      isIntermission ? 'bg-gray-100 dark:bg-gray-700 italic' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                      <div className={`font-medium ${isIntermission ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {chosen?.title || ''}
                      </div>
                      {chosen?.composer && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">{chosen.composer}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            
          </div>
        </div>
        {concert.performerDetails && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {concert.performerDetails}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
