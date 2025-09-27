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
  '/(.*)/admin(.*)',
  '/api/admin(.*)',
  '/api/concerts(.*)', // This will match all /api/concerts routes
  '/api/upload'
]);

export default clerkMiddleware(async (auth, req) => {
  // Handle API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Apply Clerk protection for protected routes
    if (isProtectedRoute(req)) {
      await auth.protect();
    }

    // Check admin role for admin routes (including admin API routes)
    if (isAdminRoute(req)) {
      const isConcertsGetRequest = req.nextUrl.pathname.startsWith('/api/concerts') && req.method === 'GET';
      const isUploadRequest = req.nextUrl.pathname.startsWith('/api/upload');
      const isConcertsWriteRequest = req.nextUrl.pathname.startsWith('/api/concerts') &&
        (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE');

      // Allow GET requests to /api/concerts for all users
      if (isConcertsGetRequest) {
        return NextResponse.next();
      }

      // Require admin access for write operations and uploads
      const { userId } = await auth();

      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const userRole = (user.publicMetadata as { role?: string } | undefined)?.role;
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Failed to verify admin access' },
          { status: 403 }
        );
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