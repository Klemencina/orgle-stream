import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Orgle koprske stolnice",
  description: "Neposredni prenosi in posnetki orgelskih koncertov iz koprske stolnice.",
};

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
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
      <Header />
      {children}
      <Footer />
    </NextIntlClientProvider>
  );
}
