import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
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

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
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
      const { sessionClaims } = await auth();
      const userRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
      
      if (userRole !== 'admin') {
        // Redirect non-admin users to the dashboard
        const url = new URL('/dashboard', req.url);
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
    const { sessionClaims } = await auth();
    const userRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    
    if (userRole !== 'admin') {
      // Redirect non-admin users to the dashboard
      const url = new URL('/dashboard', req.url);
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