'use client';

import AdminGuard from '@/components/admin/AdminGuard';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SupportReport {
  id: string;
  createdAt: string;
  resolvedAt?: string | null;
  status: 'open' | 'resolved' | string;
  email: string;
  type: string;
  message?: string | null;
  concertId: string;
  userId?: string | null;
  locale?: string | null;
  isLive?: boolean | null;
  everLive?: boolean | null;
  windowOpen?: boolean | null;
  purchased?: boolean | null;
  userAgent?: string | null;
}

export default function AdminReportsPage() {
  return (
    <AdminGuard>
      <ReportsContent />
    </AdminGuard>
  );
}

function ReportsContent() {
  const t = useTranslations('admin.dashboard');
  const params = useParams();
  const locale = params.locale as string;

  const [reports, setReports] = useState<SupportReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/reports${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const markResolved = async (id: string) => {
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved' })
      });
      if (!res.ok) throw new Error('Failed to resolve');
      await fetchReports();
    } catch (e) {
      // ignore simple error UI for now
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Status</label>
          <select
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading && <div className="text-gray-600">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && reports.length === 0 && (
        <div className="text-gray-600">No reports</div>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-medium text-gray-900 dark:text-white">{r.email} • {r.type}</div>
              <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            {r.message && <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{r.message}</div>}
            <div className="mt-2 text-xs text-gray-500 break-all">
              Concert: {r.concertId}
              {r.userId ? ` • User: ${r.userId}` : ''}
              {typeof r.purchased === 'boolean' ? ` • Purchased: ${r.purchased ? 'yes' : 'no'}` : ''}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${r.status === 'open' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{r.status}</span>
              {r.status !== 'resolved' && (
                <button
                  type="button"
                  className="ml-auto bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-1 rounded"
                  onClick={() => markResolved(r.id)}
                >
                  Mark resolved
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


