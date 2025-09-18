'use client';

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = mediaQuery.matches;
    console.log('Main page theme detection:', { isDark, prefersDark: mediaQuery.matches });
    setIsDarkMode(isDark);

    const handleChange = (e: MediaQueryListEvent) => {
      console.log('Main page theme changed:', { isDark: e.matches });
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            {t('home.subtitle')}
          </h1>
          <div className="mb-8 flex justify-center">
            <Image
              src={isDarkMode ? "/logo.svg" : "/logo-white.svg"}
              alt="Koper Cathedral Organ Logo"
              width={320}
              height={320}
              className="drop-shadow-lg"
              priority
              onLoad={() => console.log('Main page logo loaded:', isDarkMode ? "/logo.svg" : "/logo-white.svg")}
            />
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {t('home.tagline')}
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
              <div className="flex-grow">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-3xl">📅</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.upcomingConcerts')}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Pridružite se nam pri prihajajočih koncertih v živo iz koprske stolnice</p>
              </div>
              <Link href={`/${locale}/concerts`}>
                <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200">
                  Oglej si koncerte
                </button>
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
              <div className="flex-grow">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-3xl">⭐</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.recommendedConcert')}</h3>
                <p className="text-gray-600 dark:text-gray-300">Odkrijte najboljše posnetke koncertov iz naše zbirke</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
              <div className="flex-grow">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-3xl">📚</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.archiveConcerts')}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Raziskujte naš multimedijski arhiv starih koncertov</p>
              </div>
              <Link href={`https://www.youtube.com/@orglekoprskestolnice7973/videos`} target="_blank" rel="noopener noreferrer">
                <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200">
                  Dostop do arhiva
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

