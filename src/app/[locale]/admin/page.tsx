'use client';

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LocalizedConcert } from '@/types/concert';
import ConcertForm from '@/components/admin/ConcertForm';
import ConcertList from '@/components/admin/ConcertList';
import AdminGuard from '@/components/admin/AdminGuard';

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}

function AdminContent() {
  const { user } = useUser();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('admin.dashboard');
  const [concerts, setConcerts] = useState<LocalizedConcert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConcert, setEditingConcert] = useState<LocalizedConcert | null>(null);
  
  // Filter states
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);
  const [hideHiddenConcerts, setHideHiddenConcerts] = useState(false);

  useEffect(() => {
    fetchConcerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const fetchConcerts = async () => {
    try {
      setLoading(true);
      const currentLocale = locale || 'en';
      const response = await fetch(`/api/concerts?locale=${currentLocale}&admin=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(t('failedToFetch'));
      }
      const data = await response.json();
      setConcerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleConcertCreated = (concert: LocalizedConcert) => {
    setConcerts(prev => [...prev, concert]);
    setShowForm(false);
    setSuccess(t('concertCreated'));
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleConcertUpdated = (updatedConcert: LocalizedConcert) => {
    setConcerts(prev => prev.map(concert => 
      concert.id === updatedConcert.id ? updatedConcert : concert
    ));
    setEditingConcert(null);
    setShowForm(false);
    setSuccess(t('concertUpdated'));
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleConcertDeleted = (concertId: string) => {
    setConcerts(prev => prev.filter(concert => concert.id !== concertId));
  };

  const handleEditConcert = (concert: LocalizedConcert) => {
    setEditingConcert(concert);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingConcert(null);
    setShowForm(false);
  };

  // Filter concerts based on current filter states
  const filteredConcerts = concerts.filter(concert => {
    const isUpcoming = new Date(concert.date) > new Date();
    const isVisible = concert.isVisible;
    
    if (showUpcomingOnly && !isUpcoming) return false;
    if (hideHiddenConcerts && !isVisible) return false;
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('loading')}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <span className="text-4xl">🎹</span>
              {t('title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('subtitle')} {user?.firstName || 'Admin'}
            </p>
          </div>
          <div className="flex gap-4">
            <Link href={`/${locale}/concerts`}>
              <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                {t('viewPublicConcerts')}
              </button>
            </Link>
            <Link href={`/${locale}/dashboard`}>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                {t('userDashboard')}
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-2">{t('totalConcerts')}</h3>
          <p className="text-3xl font-bold text-orange-500">{concerts.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredConcerts.length} {t('shown')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-2">{t('upcoming')}</h3>
          <p className="text-3xl font-bold text-orange-500">
            {concerts.filter(c => new Date(c.date) > new Date()).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredConcerts.filter(c => new Date(c.date) > new Date()).length} {t('shown')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="font-semibold text-gray-600 dark:text-gray-300 mb-2">{t('hidden')}</h3>
          <p className="text-3xl font-bold text-orange-500">
            {concerts.filter(c => !c.isVisible).length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredConcerts.filter(c => !c.isVisible).length} {t('shown')}
          </p>
        </div>
        
      </div>

      {/* Action Buttons */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg mr-4"
        >
          + {t('addNewConcert')}
        </button>
        <button
          onClick={fetchConcerts}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          🔄 {t('refresh')}
        </button>
      </div>


      {/* Concert Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingConcert ? t('editConcert') : t('addNewConcertModal')}
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
              <ConcertForm
                concert={editingConcert}
                onConcertCreated={handleConcertCreated}
                onConcertUpdated={handleConcertUpdated}
                onCancel={handleCancelEdit}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong>{t('error')}</strong> {error}
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✓</span>
            <strong>{t('success')}</strong> {success}
          </div>
        </div>
      )}

      {/* Concert List */}
      <ConcertList
        concerts={filteredConcerts}
        onEditConcert={handleEditConcert}
        onConcertDeleted={handleConcertDeleted}
        loading={loading}
        showUpcomingOnly={showUpcomingOnly}
        setShowUpcomingOnly={setShowUpcomingOnly}
        hideHiddenConcerts={hideHiddenConcerts}
        setHideHiddenConcerts={setHideHiddenConcerts}
        totalConcerts={concerts.length}
        locale={locale}
      />
    </div>
  );
}
