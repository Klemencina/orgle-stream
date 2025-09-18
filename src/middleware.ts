import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { locales } from './i18n/request';

// Create the intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'sl',
  localeDetection: true,
});

const isProtectedRoute = createRouteMatcher([
  '/(.*)/dashboard(.*)',
  '/(.*)/admin(.*)'
]);

const isAdminRoute = createRouteMatcher([
  '/(.*)/admin(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // Skip internationalization for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Apply Clerk protection for protected routes
    if (isProtectedRoute(req)) {
      await auth.protect();
    }

    // Check admin role for admin routes
    if (isAdminRoute(req)) {
      const { userId } = await auth();
      const locale = req.nextUrl.pathname.split('/')[1] || 'sl';

      if (!userId) {
        const url = new URL(`/${locale}/dashboard`, req.url);
        return NextResponse.redirect(url);
      }

      try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const userRole = (user.publicMetadata as { role?: string } | undefined)?.role;
        if (userRole !== 'admin') {
          const url = new URL(`/${locale}/dashboard`, req.url);
          return NextResponse.redirect(url);
        }
      } catch {
        const url = new URL(`/${locale}/dashboard`, req.url);
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  // First apply the intl middleware for non-API routes
  const intlResponse = await intlMiddleware(req);

  // Then apply Clerk protection for protected routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Check admin role for admin routes
  if (isAdminRoute(req)) {
    const { userId } = await auth();
    const locale = req.nextUrl.pathname.split('/')[1] || 'sl';

    if (!userId) {
      const url = new URL(`/${locale}/dashboard`, req.url);
      return NextResponse.redirect(url);
    }

    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const userRole = (user.publicMetadata as { role?: string } | undefined)?.role;
      if (userRole !== 'admin') {
        const url = new URL(`/${locale}/dashboard`, req.url);
        return NextResponse.redirect(url);
      }
    } catch {
      const url = new URL(`/${locale}/dashboard`, req.url);
      return NextResponse.redirect(url);
    }
  }

  return intlResponse;
});

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next|.*\\..*).*)',
  ],
};