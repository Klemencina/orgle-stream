'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function PrivacyPolicyPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'sl';
  const t = useTranslations('legal.privacy');

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('title')}</h1>
        <div className="prose dark:prose-invert">
          <p>{t('intro')}</p>
          <h2>Data We Collect</h2>
          <p>{t('dataWeCollect')}</p>
          <h2>Use of Data</h2>
          <p>{t('useOfData')}</p>
          <h2>Third-Party Services</h2>
          <p>{t('thirdParties')}</p>
          <p>{t('contact', { email: 'admin@orglekoper.si' })}</p>
        </div>
        <div className="mt-8">
          <Link href={`/${locale}/concerts`} className="text-orange-600 hover:text-orange-700">{t('backToConcerts')}</Link>
        </div>
      </div>
    </main>
  );
}


