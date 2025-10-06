'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LocalizedConcert } from '@/types/concert';
import ConcertForm from '@/components/admin/ConcertForm';

export default function AdminConcertsPage() {
  const t = useTranslations('admin.dashboard');
  const params = useParams();
  const locale = params.locale as string;
  const [concerts, setConcerts] = useState<LocalizedConcert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConcert, setEditingConcert] = useState<LocalizedConcert | null>(null);

  useEffect(() => {
    fetchConcerts();
  }, []);

  const fetchConcerts = async () => {
    try {
      const response = await fetch('/api/concerts');
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
  };

  const deleteConcert = async (concertId: string) => {
    if (!confirm('Are you sure you want to delete this concert?')) {
      return;
    }

    try {
      const response = await fetch(`/api/concerts/${concertId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete concert');
      }

      // Refresh the list
      fetchConcerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete concert');
    }
  };

  const handleCreateConcert = (newConcert: LocalizedConcert) => {
    setConcerts(prev => [newConcert, ...prev]);
    setShowForm(false);
  };

  const handleUpdateConcert = (updatedConcert: LocalizedConcert) => {
    setConcerts(prev => prev.map(concert =>
      concert.id === updatedConcert.id ? updatedConcert : concert
    ));
    setShowForm(false);
    setEditingConcert(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConcert(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('loading')}</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('error')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {t('refresh')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <span className="text-3xl">⚙️</span>
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('subtitle')}
            </p>
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            + {t('addNewConcert')}
          </button>
        </div>

        {/* Concert Form */}
        {showForm && (
          <div className="mb-8">
            <ConcertForm
              concert={editingConcert}
              onConcertCreated={handleCreateConcert}
              onConcertUpdated={handleUpdateConcert}
              onCancel={handleCancel}
              locale={locale}
            />
          </div>
        )}

        {/* Concerts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('allConcerts')} ({concerts.length})
            </h3>
          </div>
          
          {concerts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-6xl mb-4">🎹</div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">{t('noConcerts')}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{t('noConcertsMessage')}</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {t('addNewConcert')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Concert
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date & Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Performer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {concerts.map((concert) => (
                    <tr key={concert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {concert.title}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                              {concert.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {new Date(concert.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {concert.venue}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {concert.performers && concert.performers.length > 0
                            ? concert.performers.map(p => p.name).join(', ')
                            : 'No performers'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {concert.program.length} pieces
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Link href={`/${locale}/concerts/${concert.id}?admin=true`}>
                            <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                              Admin View
                            </button>
                          </Link>
                          <button
                            onClick={() => {
                              setEditingConcert(concert);
                              setShowForm(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteConcert(concert.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back to Main Site */}
        <div className="mt-8 text-center">
          <Link href="/">
            <button className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
              ← Back to Main Site
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
