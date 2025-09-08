'use client';

import { SignedOut, SignedIn, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
              {t('home.title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              {t('home.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <SignUpButton>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
                  {t('auth.getStarted')}
                </button>
              </SignUpButton>
              <SignInButton>
                <button className="bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-8 rounded-lg border border-gray-300 transition-colors duration-200 shadow-lg hover:shadow-xl">
                  {t('auth.signIn')}
                </button>
              </SignInButton>
            </div>

            <div className="text-center mb-12">
              <Link href={`/${locale}/concerts`}>
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg">
                  🎹 {t('home.browseConcerts')}
                </button>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">🎵</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.features.highQualityAudio.title')}</h3>
                <p className="text-gray-600 dark:text-gray-300">{t('home.features.highQualityAudio.description')}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">🎼</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.features.organLibrary.title')}</h3>
                <p className="text-gray-600 dark:text-gray-300">{t('home.features.organLibrary.description')}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">🎹</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('home.features.communityRecordings.title')}</h3>
                <p className="text-gray-600 dark:text-gray-300">{t('home.features.communityRecordings.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <SignedInRedirect locale={locale} />
      </SignedIn>
    </div>
  );
}

function SignedInRedirect({ locale }: { locale: string }) {
  const router = useRouter();

  useEffect(() => {
    router.push(`/${locale}/concerts`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
