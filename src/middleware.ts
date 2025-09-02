import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { locales } from './i18n/request';

// Create the intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'sl',
  localeDetection: true,
});

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // First apply the intl middleware
  const intlResponse = await intlMiddleware(req);

  // Then apply Clerk protection for protected routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return intlResponse;
});

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next|.*\\..*).*)',
  ],
};