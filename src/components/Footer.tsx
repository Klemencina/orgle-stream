'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const pathname = usePathname();
  const t = useTranslations('policy');
  const locale = (pathname?.split('/')?.[1] || 'sl');

  return (
    <footer className="mt-16 border-t border-gray-200 dark:border-gray-800 py-8 text-center text-sm text-gray-600 dark:text-gray-300">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <Link href={`/${locale}/refund-policy`} className="hover:text-orange-500 dark:hover:text-orange-400">
            {t('refundPolicy')}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-orange-500 dark:hover:text-orange-400">
            {/* uses legal.privacyPolicy from i18n */}
            {useTranslations('legal')('privacyPolicy')}
          </Link>
          <Link href={`/${locale}/data-deletion`} className="hover:text-orange-500 dark:hover:text-orange-400">
            {/* uses legal.dataDeletion from i18n */}
            {useTranslations('legal')('dataDeletion')}
          </Link>
        </div>
      </div>
    </footer>
  );
}


