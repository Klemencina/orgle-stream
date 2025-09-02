import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
export const locales = ['en', 'sl', 'it'] as const;
export type Locale = typeof locales[number];

export default getRequestConfig(async ({ locale }) => {
  // If no locale is provided, default to Slovenian
  if (!locale) {
    locale = 'sl';
  }

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as unknown as Locale)) {
    console.log('Invalid locale:', locale, 'falling back to sl');
    locale = 'sl';
  }

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
