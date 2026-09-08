'use client';

import AdminGuard from '@/components/admin/AdminGuard';
import { useEffect, useState } from 'react';

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
  const [reports, setReports] = useState<SupportReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('open');

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReports() {
      setLoading(true);
      setError(null);
      try {
        const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
        const res = await fetch(`/api/admin/reports${qs}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('Could not load reports. Try refreshing.');
        const data = await res.json();
        if (!Array.isArray(data.items)) throw new Error('Could not load reports. Try refreshing.');
        if (!controller.signal.aborted) setReports(data.items);
      } catch (e: unknown) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load reports.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchReports();
    return () => controller.abort();
  }, [statusFilter, refresh]);

  const changeStatus = async (id: string, status: 'open' | 'resolved') => {
    if (savingId) return;
    setSavingId(id);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const data = await res.json();
      if (!res.ok || data.ok !== true || data.item?.id !== id || data.item?.status !== status) {
        throw new Error('Could not save the report status. Refresh to check its current status before trying again.');
      }
      setRefresh(value => value + 1);
    } catch {
      setSaveError('Could not save the report status. Refresh to check its current status before trying again.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex items-center gap-2">
          <button type="button" disabled={loading || !!savingId} onClick={() => { setSaveError(null); setRefresh(value => value + 1); }} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-60">Refresh</button>
          <label htmlFor="report-status" className="text-sm text-gray-600 dark:text-gray-300">Status</label>
          <select
            id="report-status"
            disabled={!!savingId}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'open' | 'resolved' | 'all')}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading && <div className="text-gray-600">Loading…</div>}
      {error && <div role="alert" className="text-red-600 dark:text-red-400">{error}</div>}
      {saveError && <div role="alert" className="text-red-600 dark:text-red-400">{saveError}</div>}

      {!loading && !error && reports.length === 0 && (
        <div className="text-gray-600">No reports</div>
      )}

      <div className="space-y-3">
        {!loading && !error && reports.map((r) => (
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
              {(
                <button
                  type="button"
                  className="ml-auto bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-3 py-1 rounded"
                  disabled={!!savingId}
                  onClick={() => changeStatus(r.id, r.status === 'resolved' ? 'open' : 'resolved')}
                >
                  {savingId === r.id ? 'Saving...' : r.status === 'resolved' ? 'Reopen' : 'Mark resolved'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


