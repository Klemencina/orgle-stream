'use client';

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please sign in to view your dashboard</h1>
            <Link href="/" className="bg-orange-500 text-white px-4 py-2 rounded">
              Go to Home
            </Link>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <DashboardContent />
      </SignedIn>
    </div>
  );
}

function DashboardContent() {
  const params = useParams();
  const locale = params.locale as string;
  const [past, setPast] = useState<Array<{ ticketId: string; stripePaymentIntentId: string | null; stripeCheckoutSessionId: string | null; concertId: string; date: string; title: string; subtitle: string | null; venue: string; amountCents: number; currency: string; purchasedAt: string }>>([]);
  const [upcoming, setUpcoming] = useState<Array<{ ticketId: string; stripePaymentIntentId: string | null; stripeCheckoutSessionId: string | null; concertId: string; date: string; title: string; subtitle: string | null; venue: string; amountCents: number; currency: string; purchasedAt: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [pastRes, upcomingRes] = await Promise.all([
          fetch(`/api/me/tickets/past?when=past&locale=${encodeURIComponent(locale)}`, { cache: 'no-store' }),
          fetch(`/api/me/tickets/past?when=upcoming&locale=${encodeURIComponent(locale)}`, { cache: 'no-store' }),
        ]);
        if (!pastRes.ok || !upcomingRes.ok) throw new Error('Failed to load tickets');
        const [pastData, upcomingData] = await Promise.all([pastRes.json(), upcomingRes.json()]);
        if (isMounted) {
          type TicketItem = {
            ticketId: string
            stripePaymentIntentId: string | null
            stripeCheckoutSessionId: string | null
            concertId: string
            date: string | number | Date
            title: string
            subtitle: string | null
            venue: string
            amountCents: number
            currency: string
            purchasedAt: string | number | Date
          }
          setPast((pastData.items || []).map((it: TicketItem) => ({
            ...it,
            date: typeof it.date === 'string' ? it.date : new Date(it.date).toISOString(),
            purchasedAt: typeof it.purchasedAt === 'string' ? it.purchasedAt : new Date(it.purchasedAt).toISOString(),
          })));
          setUpcoming((upcomingData.items || []).map((it: TicketItem) => ({
            ...it,
            date: typeof it.date === 'string' ? it.date : new Date(it.date).toISOString(),
            purchasedAt: typeof it.purchasedAt === 'string' ? it.purchasedAt : new Date(it.purchasedAt).toISOString(),
          })));
        }
      } catch (e: unknown) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false };
  }, [locale]);

  return (
    <div className="container mx-auto px-4 py-8">


      {/* Upcoming Purchases */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Concerts You Bought</h2>
        {loading && (
          <p className="text-gray-600">Loading…</p>
        )}
        {error && (
          <p className="text-red-600">{error}</p>
        )}
        {!loading && !error && upcoming.length === 0 && (
          <p className="text-gray-600">No upcoming concerts found.</p>
        )}
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcoming.map(item => (
            <li key={item.ticketId} className="py-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{item.title}</div>
                {item.subtitle && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">{item.subtitle}</div>
                )}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {new Date(item.date).toLocaleString()} • {item.venue}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Purchased {new Date(item.purchasedAt).toLocaleDateString()} — {(item.amountCents / 100).toLocaleString(undefined, { style: 'currency', currency: item.currency.toUpperCase() })}
                </div>
                <div className="text-xs text-gray-500 mt-1 break-all">
                  Ticket ID: {item.ticketId}
                </div>
                {item.stripeCheckoutSessionId && (
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    Stripe Checkout Session: {item.stripeCheckoutSessionId}
                  </div>
                )}
                {item.stripePaymentIntentId && (
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    Stripe Payment Intent: {item.stripePaymentIntentId}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <Link href={`/${locale}/concerts/${item.concertId}`}>
                  <button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-2 rounded">
                    View concert
                  </button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Past Purchases */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Past Concerts You Bought</h2>
        {loading && (
          <p className="text-gray-600">Loading…</p>
        )}
        {error && (
          <p className="text-red-600">{error}</p>
        )}
        {!loading && !error && past.length === 0 && (
          <p className="text-gray-600">No past concerts found.</p>
        )}
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {past.map(item => (
            <li key={item.ticketId} className="py-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{item.title}</div>
                {item.subtitle && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">{item.subtitle}</div>
                )}
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {new Date(item.date).toLocaleString()} • {item.venue}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Purchased {new Date(item.purchasedAt).toLocaleDateString()} — {(item.amountCents / 100).toLocaleString(undefined, { style: 'currency', currency: item.currency.toUpperCase() })}
                </div>
                <div className="text-xs text-gray-500 mt-1 break-all">
                  Ticket ID: {item.ticketId}
                </div>
                {item.stripeCheckoutSessionId && (
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    Stripe Checkout Session: {item.stripeCheckoutSessionId}
                  </div>
                )}
                {item.stripePaymentIntentId && (
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    Stripe Payment Intent: {item.stripePaymentIntentId}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <Link href={`/${locale}/concerts/${item.concertId}`}>
                  <button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-2 rounded">
                    View concert
                  </button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


