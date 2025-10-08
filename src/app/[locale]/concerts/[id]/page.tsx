'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LocalizedConcert, ProgramPiece } from '@/types/concert';
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs';
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
  const { user, isLoaded } = useUser();
  const isAdminClient = isLoaded && ((user?.publicMetadata as Record<string, unknown> | undefined)?.role === 'admin');

  const [timeLeft, setTimeLeft] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLive, setIsLive] = useState(false);
  const [everLive, setEverLive] = useState(false);
  const [concert, setConcert] = useState<LocalizedConcert | null>(null);
  const [fullProgram, setFullProgram] = useState<ProgramPiece[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programView, setProgramView] = useState<'sl' | 'original'>('sl');
  const [imageOrientationByPerformer, setImageOrientationByPerformer] = useState<Record<number, 'portrait' | 'landscape'>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');
  const [purchased, setPurchased] = useState<boolean | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportType, setReportType] = useState<'access' | 'quality' | 'payment' | 'other'>('access');
  const [reportMessage, setReportMessage] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmittedId, setReportSubmittedId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmittedEmail, setReportSubmittedEmail] = useState<string | null>(null);

  const openLightbox = (src: string, alt: string) => {
    setLightboxSrc(src);
    setLightboxAlt(alt);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxSrc(null);
    setLightboxAlt('');
  };

  useEffect(() => {
    async function fetchConcert() {
      try {
        const currentLocale = locale || 'en';
        const isAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'true';
        const adminQuery = isAdmin ? '&admin=true' : '';
        const response = await fetch(`/api/concerts/${concertId}?locale=${currentLocale}${adminQuery}`, {
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
        const fullRes = await fetch(`/api/concerts/${concertId}?allTranslations=true${isAdmin ? '&admin=true' : ''}`, {
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
    async function fetchPurchase() {
      if (!concertId) return;
      try {
        const res = await fetch(`/api/purchase?concertId=${concertId}`, { cache: 'no-store' });
        if (!res.ok) {
          setPurchased(false);
          return;
        }
        const data = await res.json();
        setPurchased(Boolean(data?.purchased));
      } catch {
        setPurchased(false);
      }
    }
    fetchPurchase();
  }, [concertId]);

  // If returning from checkout, poll a few times to wait for webhook and refresh purchase state
  useEffect(() => {
    if (!concertId) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cameFromCheckout = params.get('checkout') === 'success';
    const sessionId = params.get('session_id');
    if (!cameFromCheckout) return;

    let aborted = false;
    (async () => {
      const maxAttempts = 6;
      for (let attempt = 1; attempt <= maxAttempts && !aborted; attempt++) {
        try {
          const url = sessionId ? `/api/purchase?concertId=${concertId}&sessionId=${encodeURIComponent(sessionId)}` : `/api/purchase?concertId=${concertId}`
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const isPurchased = Boolean(data?.purchased);
            setPurchased(isPurchased);
            if (isPurchased) break;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      // Clean checkout param from URL
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());
      } catch {}
    })();

    return () => { aborted = true };
  }, [concertId]);

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
            {concert.title}
          </h1>
          {concert.subtitle && (
            <div className="text-xl text-gray-700 dark:text-gray-200 mb-1">{concert.subtitle}</div>
          )}
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

            {/* Countdown Timer - only show if concert hasn't started and hasn't ended */}
            {!isLive && !everLive && !hasEnded && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                  {t('concert.countdown')}
                </h3>

                {windowOpen ? (
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
            )}

            {/* Purchase/Login CTA - hidden for admins */}
            {purchased === false && !isAdminClient && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                  {t('concert.purchaseToWatch')}
                </h3>
                {typeof (concert as Partial<LocalizedConcert> & { priceAmountCents?: number; priceCurrency?: string }).priceAmountCents === 'number' && (
                  <p className="text-center text-gray-700 dark:text-gray-200 mb-4">
                    {new Intl.NumberFormat(locale, { style: 'currency', currency: ((concert as Partial<LocalizedConcert> & { priceCurrency?: string }).priceCurrency || 'eur').toUpperCase() }).format((((concert as Partial<LocalizedConcert> & { priceAmountCents?: number }).priceAmountCents || 0) / 100))}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <SignedIn>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
                      {t('policy.refundNotice')} <a href={`/${locale}/refund-policy`} className="underline hover:text-orange-500 dark:hover:text-orange-400">{t('policy.refundPolicy')}</a>.
                    </p>
                    <button
                      className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                    onClick={async () => {
                        try {
                        const origin = typeof window !== 'undefined' ? window.location.origin : ''
                        const successUrl = `${origin}/${locale}/concerts/${concert.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
                        const cancelUrl = `${origin}/${locale}/concerts/${concert.id}?checkout=cancel`
                          const res = await fetch('/api/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ concertId: concert.id, successUrl, cancelUrl })
                          })
                          const data = await res.json()
                          if (data?.url) {
                            window.location.href = data.url
                          }
                        } catch {}
                      }}
                      type="button"
                    >
                      {t('concert.buyTicket')}
                    </button>
                  </SignedIn>
                  <SignedOut>
                    <a
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 text-center"
                      href={`/${locale}/sign-in?redirect=/${locale}/concerts/${concert.id}`}
                    >
                      {t('concert.loginToPurchase')}
                    </a>
                  </SignedOut>
                </div>
              </div>
            )}

            {/* Live status visible to all; stream player only for purchasers */}
            {(isLive || (everLive && windowOpen)) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                  {t('concert.liveNow')}
                </h3>
                {(purchased === true || isAdminClient) && (
                  <>
                    <div className="mb-4">
                      <StreamPlayer key={`stream-${concert.id}`} concertId={concert.id} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Purchased message when not live yet */}
            {purchased === true && !(isLive || (everLive && windowOpen)) && !hasEnded && (
              <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-green-800 dark:text-green-200 text-center font-medium">
                  {t('concert.ticketPurchased')}
                </p>
              </div>
            )}

          {/* Report a problem - available to all users */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('concert.report.title')}</h3>
              {!reportOpen && (
                <button
                  type="button"
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded"
                  onClick={() => setReportOpen(true)}
                >
                  {t('concert.report.openButton')}
                </button>
              )}
            </div>
            {reportOpen && (
              <form
                className="mt-4 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (reportSubmitting) return;
                  setReportError(null);
                  setReportSubmitting(true);
                  setReportSubmittedId(null);
                  try {
                    const res = await fetch('/api/support/report', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: reportEmail,
                        type: reportType,
                        message: reportMessage,
                        concertId: concert.id,
                        locale,
                        isLive,
                        everLive,
                        windowOpen,
                        purchased,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(data?.error || 'submit_failed');
                    }
                    setReportSubmittedId(data?.caseId || null);
                    setReportSubmittedEmail(reportEmail);
                    setReportEmail('');
                    setReportMessage('');
                    setReportType('access');
                    } catch (err: unknown) {
                    setReportError(err instanceof Error ? err.message : 'submit_failed');
                  } finally {
                    setReportSubmitting(false);
                  }
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('concert.report.emailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    placeholder={t('concert.report.emailPlaceholder')}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('concert.report.typeLabel')}
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as 'access' | 'quality' | 'payment' | 'other')}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                  >
                    <option value="access">{t('concert.report.type.access')}</option>
                    <option value="quality">{t('concert.report.type.quality')}</option>
                    <option value="payment">{t('concert.report.type.payment')}</option>
                    <option value="other">{t('concert.report.type.other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('concert.report.messageLabel')}
                  </label>
                  <textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder={t('concert.report.messagePlaceholder')}
                    rows={4}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                  />
                </div>
                {reportError && (
                  <div className="text-red-600 text-sm">{t('concert.report.submitError')}</div>
                )}
                {reportSubmittedId && (
                  <div className="space-y-1">
                    <div className="text-green-700 dark:text-green-300 text-sm">
                      {t('concert.report.submitSuccess')} #{reportSubmittedId}
                    </div>
                    {reportSubmittedEmail && (
                      <div className="text-gray-700 dark:text-gray-300 text-xs">
                        {t('concert.report.replyNotice', { email: reportSubmittedEmail })}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded"
                  >
                    {reportSubmitting ? t('concert.report.submitting') : t('concert.report.submit')}
                  </button>
                  <button
                    type="button"
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded"
                    onClick={() => { setReportOpen(false); setReportError(null); }}
                  >
                    {t('concert.report.close')}
                  </button>
                </div>
              </form>
            )}
          </div>

            {/* Venue Details */}

            {/* Performers Section */}
            {concert.performers && concert.performers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span>🎤</span>
                  {t('concert.performerInfo')}
                </h3>
                <div className="space-y-6">
                  {concert.performers.map((performer, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{performer.name}</h4>
                      {performer.img && (
                        <div className="float-left mr-4 mb-2">
                          <Image
                            src={performer.img}
                            alt={performer.name}
                            width={200}
                            height={200}
                            className={`rounded-lg shadow-md cursor-zoom-in ${imageOrientationByPerformer[index] === 'landscape' ? 'w-48 md:w-72 h-auto object-contain bg-gray-100' : 'w-32 h-32 md:w-48 md:h-48 object-cover'}`}
                            onClick={() => openLightbox(performer.img!, performer.name)}
                            onLoadingComplete={(img) => {
                              const orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
                              setImageOrientationByPerformer((prev) => ({ ...prev, [index]: orientation }));
                            }}
                            onError={(e) => {
                              // Hide the image on error
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {performer.opis && (
                        <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed whitespace-pre-wrap overflow-wrap-anywhere break-words">{performer.opis}</p>
                      )}
                      <div className="clear-both"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
      </div>
      {lightboxOpen && lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="button"
          aria-label="Close image"
        >
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-10 right-0 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded px-3 py-1"
              onClick={closeLightbox}
              aria-label="Close"
            >
              ✕
            </button>
            <Image
              src={lightboxSrc}
              alt={lightboxAlt}
              width={1200}
              height={800}
              className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
