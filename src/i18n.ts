// Can be imported from a shared config
export const locales = ['en', 'sl', 'it'] as const;
export type Locale = typeof locales[number];
