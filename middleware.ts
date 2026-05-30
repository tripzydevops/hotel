/**
 * Next.js Edge Middleware — Server-Side Authentication Guard
 *
 * SECURITY REWRITE (SOC 2 / OWASP A07 Remediation)
 *
 * Previous implementation delegated ALL auth decisions to client-side
 * in-memory tokens (InsForge SDK TokenManager), which meant:
 *   - Any user could directly navigate to /dashboard by disabling JavaScript
 *   - Auth bypass was trivially achievable via browser devtools
 *   - Penetration testers would flag this as a P1 finding immediately
 *
 * HOW INSFORGE AUTH WORKS (server-side):
 *   - On login, InsForge server sets an httpOnly refresh cookie on the browser
 *   - The browser sends this cookie automatically on every request (including
 *     the middleware Edge request) — the JS layer never sees its value
 *   - We validate it by calling POST /api/auth/refresh; a 200 response means
 *     the session is valid, a 401 means it is not
 *
 * This middleware runs at the Edge (before any page renders) and validates
 * the session via the InsForge refresh endpoint. This cannot be bypassed
 * by client-side JavaScript.
 *
 * Responsibilities:
 *   1. Redirect unauthenticated users from protected routes → /login
 *   2. Redirect authenticated users away from /login → /dashboard
 *   3. Allow all public routes and Next.js internals to pass through
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

/** Routes that require a valid session. Anything NOT listed here is public. */
const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/analysis',
  '/reports',
  '/parity-monitor',
  '/admin',
  '/help',
  '/debug',
];

/** Routes that authenticated users should be redirected away from. */
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
// InsForge session validator
// ---------------------------------------------------------------------------

/**
 * Validates the current session by calling InsForge's refresh endpoint.
 *
 * The InsForge SDK sets an httpOnly refresh cookie on login. The browser
 * forwards this cookie automatically on every Edge request. We hit
 * POST /api/auth/refresh — a 200 means a valid session exists.
 *
 * We forward ALL cookies from the incoming request so the server sees the
 * httpOnly refresh cookie it set.
 */
async function isSessionValid(request: NextRequest): Promise<boolean> {
  const insforgeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!insforgeUrl) {
    // No backend URL configured — skip server check, client guard handles it.
    console.warn('[Middleware] NEXT_PUBLIC_SUPABASE_URL not set. Skipping auth check.');
    return true;
  }

  try {
    // Forward all cookies so the httpOnly refresh token cookie reaches InsForge.
    const cookieHeader = request.headers.get('cookie') ?? '';

    const response = await fetch(`${insforgeUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      // Edge runtime: no body needed; the refresh cookie is the credential.
    });

    return response.ok; // 200 = valid session, 401/403 = no valid session

  } catch (err) {
    // Network error (InsForge unreachable) — fail open to avoid locking out
    // users during backend downtime. The FastAPI backend will still enforce auth.
    console.error('[Middleware] InsForge auth check failed (network error):', err);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast-path: not a route we care about — skip immediately.
  if (!isProtectedPath(pathname) && !isAuthOnlyPath(pathname)) {
    return NextResponse.next();
  }

  const authenticated = await isSessionValid(request);

  // ── Case 1: Protected route + no session → redirect to login ──────────────
  if (isProtectedPath(pathname) && !authenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve intended destination so login page can redirect back after auth.
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Case 2: Already logged in + visiting /login → redirect to dashboard ───
  if (isAuthOnlyPath(pathname) && authenticated) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  // ── Case 3: All checks passed ──────────────────────────────────────────────
  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Matcher — which requests this middleware runs on
// ---------------------------------------------------------------------------
// Excludes Next.js internals and static assets to minimise Edge invocations.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};


