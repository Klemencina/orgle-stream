'use client';

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
    <header className="flex justify-between items-center p-4 gap-4 h-16 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-center">
        <Link href={`/${currentLocale}`} className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <span className="text-2xl">🎹</span>
          Orgle Stream
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Link href={`/${currentLocale}/concerts`} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">
          Concerts
        </Link>
        <LanguageSwitcher />
        <SignedOut>
          <SignInButton />
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          {isLoaded && isAdmin && (
            <Link href={`/${currentLocale}/admin`}>
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 mr-2">
                Admin
              </button>
            </Link>
          )}
          <Link href={`/${currentLocale}/dashboard`}>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
              Dashboard
            </button>
          </Link>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
