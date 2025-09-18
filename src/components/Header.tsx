'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Header() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const t = useTranslations();
  const tAuth = useTranslations('auth');

  // Extract current locale from pathname, default to Slovenian
  const currentLocale = pathname.split('/')[1] || 'sl';

  // Update the document lang attribute when locale changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLocale;
    }
  }, [currentLocale]);

  // Check if user is admin
  const isAdmin = user?.publicMetadata?.role === 'admin';

  return (
    <header className="relative flex items-center p-4 h-16 bg-white dark:bg-gray-800 shadow-sm">
      {/* Left side - Title */}
      <div className="flex items-center flex-shrink-0">
        <Link href={`/${currentLocale}`} className="text-xl font-bold text-orange-500 dark:text-orange-400 flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={48} height={48} priority />
          {t('home.title')}
        </Link>
      </div>

      

      {/* Right side - Navigation and auth */}
      <div className="flex items-center gap-4 ml-auto">
        <Link href={`/${currentLocale}/concerts`} className="text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors">
          {t('nav.concerts')}
        </Link>
        <LanguageSwitcher />
        <SignedOut>
          <div className="flex items-center gap-3">
            <Link href={`/${currentLocale}/sign-in`}>
              <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                {tAuth('signIn')}
              </button>
            </Link>
            <Link href={`/${currentLocale}/sign-up`}>
              <button className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                {tAuth('signUp')}
              </button>
            </Link>
          </div>
        </SignedOut>
        <SignedIn>
          <div className="flex items-center gap-3">
            {isLoaded && isAdmin && (
              <Link href={`/${currentLocale}/admin`}>
                <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                  Admin
                </button>
              </Link>
            )}
            <Link href={`/${currentLocale}/dashboard`}>
              <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                Dashboard
              </button>
            </Link>
            <UserButton />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}
