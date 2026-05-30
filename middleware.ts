/**
 * Next.js Edge Middleware
 *
 * CURRENT STATUS: Pass-through (auth enforced client-side via useAuth hook)
 *
 * WHY THE SERVER-SIDE APPROACH WAS REVERTED:
 * The InsForge SDK (lib/insforge.ts) makes auth requests directly to the
 * InsForge backend domain (NEXT_PUBLIC_SUPABASE_URL). This means InsForge
 * sets its httpOnly refresh cookie on the **InsForge domain**, not on the
 * Vercel/app domain.
 *
 * When Next.js middleware intercepts a request to /dashboard, it only sees
 * cookies scoped to the app domain. The InsForge refresh cookie is invisible
 * to the middleware, so any attempt to validate the session by forwarding
 * cookies to InsForge will always appear unauthenticated — even for logged-in
 * users. This caused a login redirect loop.
 *
 * WHAT IS NEEDED FOR A PROPER FIX (next milestone):
 * Option A — Proxy InsForge auth through Next.js:
 *   Add a Next.js Route Handler at app/api/auth/[...path]/route.ts that
 *   proxies all /api/auth/* calls to InsForge. The app (not InsForge) then
 *   owns the cookie domain, and the middleware can validate sessions properly.
 *
 * Option B — Dual-cookie after login:
 *   After a successful InsForge login, call a Next.js Route Handler that
 *   issues a short-lived, app-domain HttpOnly session cookie. Middleware
 *   validates this cookie (cryptographically signed with a server secret).
 *
 * ACTIVE PROTECTION (until above is implemented):
 *   - useAuth hook: redirects to /login if no in-memory session
 *   - useAdminGuard hook: validates admin role + email whitelist
 *   - FastAPI backend: enforces Bearer token on every API call
 *   - IDOR prevention: UUID ownership checks on all endpoints (d3270c21)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|auth|rest|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
