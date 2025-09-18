'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Detect theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = mediaQuery.matches;
    console.log('Theme detection:', { isDark, prefersDark: mediaQuery.matches });
    setIsDarkMode(isDark);

    const handleChange = (e: MediaQueryListEvent) => {
      console.log('Theme changed:', { isDark: e.matches });
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <header className="relative bg-white dark:bg-gray-800 shadow-sm">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between p-4 h-16">
        {/* Left side - Title */}
        <div className="flex items-center flex-shrink-0">
          <Link href={`/${currentLocale}`} className="text-xl font-bold text-orange-500 dark:text-orange-400 flex items-center gap-2">
            <Image 
              src={isDarkMode ? "/logo.svg" : "/logo-white.svg"} 
              alt="Logo" 
              width={48} 
              height={48} 
              priority 
              onLoad={() => console.log('Desktop logo loaded:', isDarkMode ? "/logo.svg" : "/logo-white.svg")}
            />
            {t('home.title')}
          </Link>
        </div>

        {/* Right side - Navigation and auth */}
        <div className="flex items-center gap-4">
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
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 h-16">
        {/* Left side - Title */}
        <div className="flex items-center flex-shrink-0">
          <Link href={`/${currentLocale}`} className="text-lg font-bold text-orange-500 dark:text-orange-400 flex items-center gap-2">
            <Image 
              src={isDarkMode ? "/logo.svg" : "/logo-white.svg"} 
              alt="Logo" 
              width={36} 
              height={36} 
              priority 
              onLoad={() => console.log('Mobile logo loaded:', isDarkMode ? "/logo.svg" : "/logo-white.svg")}
            />
            <span className="truncate">{t('home.title')}</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          aria-label="Toggle mobile menu"
        >
          <svg
            className="w-6 h-6 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4 space-y-4">
            {/* Navigation Links */}
            <div className="space-y-2">
              <Link
                href={`/${currentLocale}/concerts`}
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.concerts')}
              </Link>
            </div>

            {/* Language Switcher */}
            <div className="py-2">
              <LanguageSwitcher />
            </div>

            {/* Auth Buttons */}
            <SignedOut>
              <div className="space-y-2">
                <Link href={`/${currentLocale}/sign-in`} onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                    {tAuth('signIn')}
                  </button>
                </Link>
                <Link href={`/${currentLocale}/sign-up`} onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                    {tAuth('signUp')}
                  </button>
                </Link>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="space-y-2">
                {isLoaded && isAdmin && (
                  <Link href={`/${currentLocale}/admin`} onClick={() => setIsMobileMenuOpen(false)}>
                    <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                      Admin
                    </button>
                  </Link>
                )}
                <Link href={`/${currentLocale}/dashboard`} onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm">
                    Dashboard
                  </button>
                </Link>
                <div className="pt-2">
                  <UserButton />
                </div>
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
