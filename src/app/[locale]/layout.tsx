import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: "Orgle Stream - Organ Music Streaming",
  description: "Stream your local organ music with a modern, secure platform.",
};

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  // Await the params before destructuring
  const { locale } = await params;

  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    console.error('LocaleLayout - error loading messages:', error);
    // Return a fallback for unsupported locales
    messages = {};
  }

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
