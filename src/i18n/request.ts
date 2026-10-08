import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
export const locales = ['en', 'sl', 'it'] as const;
export type Locale = typeof locales[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = locales.includes(requestedLocale as Locale)
    ? requestedLocale as Locale
    : 'sl';

  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return {
      messages,
      locale
    };
  } catch (error) {
    console.error('Error loading messages for locale:', locale, error);
    // Fallback to Slovenian
    const messages = (await import(`../../messages/sl.json`)).default;
    return {
      messages,
      locale: 'sl'
    };
  }
});
