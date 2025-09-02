'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
] as const;

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Extract current locale from pathname, default to Slovenian
  const segments = pathname.split('/').filter(Boolean);
  const currentLocale = segments.length > 0 && ['en', 'sl', 'it'].includes(segments[0]) ? segments[0] : 'sl';

  const switchLanguage = (newLocale: string) => {
    startTransition(() => {
      // Always use the current pathname and replace the locale
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0 && ['en', 'sl', 'it'].includes(segments[0])) {
        // Replace the locale segment
        segments[0] = newLocale;
        const newPathname = '/' + segments.join('/');
        router.replace(newPathname);
      } else {
        // Add locale prefix to the current path
        const newPathname = `/${newLocale}${pathname === '/' ? '' : pathname}`;
        router.replace(newPathname);
      }
    });
  };

  return (
    <div className="relative inline-block">
      <select
        value={currentLocale}
        onChange={(e) => switchLanguage(e.target.value)}
        disabled={isPending}
        className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
