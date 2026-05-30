/**
 * Next.js Edge Middleware — Server-Side Authentication Guard
 *
 * IMPLEMENTATION: Dual-Cookie Pattern
 *
 * InsForge sets its httpOnly refresh cookie on the InsForge domain, not the
 * app domain. So we can't read it here. Instead, after InsForge login, the
 * login page calls POST /api/auth/session which issues our own `hp_sess`
 * HttpOnly cookie on the APP domain — HMAC-signed with SESSION_SECRET.
 *
 * This middleware:
 *   1. Reads the `hp_sess` cookie (app-domain, readable server-side)
 *   2. Verifies the HMAC signature + expiry using SESSION_SECRET
 *   3. Redirects unauthenticated users → /login?redirectTo=<path>
 *   4. Redirects authenticated users away from /login → /dashboard
 *
 * Falls back to pass-through if SESSION_SECRET is not configured
 * (so local dev without env vars still works, guarded by client-side hooks).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/analysis',
  '/reports',
  '/parity-monitor',
  '/admin',
  '/help',
  '/debug',
];

const AUTH_ONLY_PATHS = ['/login'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast-path: skip routes we don't protect
  if (!isProtectedPath(pathname) && !isAuthOnlyPath(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;

  // If SESSION_SECRET isn't configured (e.g. local dev), skip server-side
  // check. Client-side useAuth hook handles protection in that case.
  if (!secret) {
    console.warn(
      '[Middleware] SESSION_SECRET not set — skipping server auth check.'
    );
    return NextResponse.next();
  }

  // Read and verify the app-domain session cookie
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const session = cookieValue ? await verifySession(cookieValue, secret) : null;
  const isAuthenticated = session !== null;

  // ── Case 1: Protected route + no valid session → redirect to login ─────────
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Case 2: Already authenticated + visiting /login → go to dashboard ──────
  if (isAuthOnlyPath(pathname) && isAuthenticated) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    '/((?!api|auth|rest|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
