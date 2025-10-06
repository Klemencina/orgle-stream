'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LocalizedConcert } from '@/types/concert';

interface ConcertListProps {
  concerts: LocalizedConcert[];
  onEditConcert: (concert: LocalizedConcert) => void;
  onConcertDeleted: (concertId: string) => void;
  loading: boolean;
  // Filter props
  showUpcomingOnly: boolean;
  setShowUpcomingOnly: (value: boolean) => void;
  hideHiddenConcerts: boolean;
  setHideHiddenConcerts: (value: boolean) => void;
  totalConcerts: number;
  locale: string;
}

export default function ConcertList({
  concerts,
  onEditConcert,
  onConcertDeleted,
  loading,
  showUpcomingOnly,
  setShowUpcomingOnly,
  hideHiddenConcerts,
  setHideHiddenConcerts,
  totalConcerts,
  locale
}: ConcertListProps) {
  const t = useTranslations('admin.list');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (concertId: string) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    setDeletingId(concertId);
    try {
      const response = await fetch(`/api/concerts/${concertId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(t('deleteError'));
      }

      onConcertDeleted(concertId);
    } catch (error) {
      console.error('Error deleting concert:', error);
      alert(t('deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (concerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🎹</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('noConcerts')}</h3>
          <p className="text-gray-600 dark:text-gray-300">{t('noConcertsMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('allConcerts')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {concerts.length} {concerts.length !== 1 ? t('concertsTotal') : t('concertTotal')}
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showUpcomingOnly}
                  onChange={(e) => setShowUpcomingOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {t('showOnlyUpcoming')}
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hideHiddenConcerts}
                  onChange={(e) => setHideHiddenConcerts(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {t('hideHidden')}
                </span>
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('showing')} {concerts.length} {t('of')} {totalConcerts}
              </span>
              {(showUpcomingOnly || hideHiddenConcerts) && (
                <button
                  onClick={() => {
                    setShowUpcomingOnly(false);
                    setHideHiddenConcerts(false);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {t('clear')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('concert')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('dateTime')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('venue')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
            {concerts.map((concert) => (
              <tr key={concert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="ml-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {concert.title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {concert.performers && concert.performers.length > 0
                          ? concert.performers.map(p => p.name).join(', ')
                          : 'No performers'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatDate(concert.date)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {concert.venue}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    isUpcoming(concert.date)
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {isUpcoming(concert.date) ? t('upcoming') : t('past')}
                  </span>
                  
                  {!concert.isVisible && (
                    <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      {t('hidden')}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <a
                      href={`/${locale}/concerts/${concert.id}?admin=true`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View"
                    >
                      View
                    </a>
                    <button
                      onClick={() => onEditConcert(concert)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(concert.id)}
                      disabled={deletingId === concert.id}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === concert.id ? t('deleting') : t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
