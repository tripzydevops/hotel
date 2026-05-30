/**
 * Route Handler: POST /api/auth/session
 * Route Handler: DELETE /api/auth/session
 *
 * PURPOSE:
 * After the InsForge SDK logs a user in (client-side), the login page calls
 * this endpoint with the InsForge access token. This handler:
 *   1. Verifies the token is genuine by calling InsForge /api/auth/sessions/current
 *   2. Issues an HttpOnly `hp_sess` cookie on the APP domain (not InsForge domain)
 *   3. The middleware can then read this cookie server-side on every request
 *
 * This is the "dual-cookie" pattern that bridges InsForge's auth model with
 * Next.js server-side middleware authentication.
 *
 * POST  → Issue session cookie (called after successful InsForge login)
 * DELETE → Clear session cookie (called on logout)
 */
import { NextRequest, NextResponse } from 'next/server';
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session';

const INSFORGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SESSION_SECRET = process.env.SESSION_SECRET!;

// ---------------------------------------------------------------------------
// POST — issue session cookie after successful InsForge login
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!SESSION_SECRET) {
    console.error('[/api/auth/session] SESSION_SECRET env var is not set!');
    return NextResponse.json(
      { error: 'Server misconfiguration: SESSION_SECRET missing' },
      { status: 500 }
    );
  }

  let token: string;
  let uid: string | undefined;
  let email: string | undefined;

  try {
    const body = await request.json();
    token = body.token;
    uid = body.uid;
    email = body.email;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  // ── Verify the token is genuine with InsForge ────────────────────────────
  // We call InsForge's "current session" endpoint with the provided Bearer
  // token. If InsForge returns a user, the token is valid.
  let verifiedUid = uid;
  let verifiedEmail = email;

  try {
    const res = await fetch(`${INSFORGE_URL}/api/auth/sessions/current`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'InsForge token verification failed' },
        { status: 401 }
      );
    }

    // InsForge returns session data — extract user info for the cookie payload
    const sessionData = await res.json();
    verifiedUid = sessionData?.user?.id || sessionData?.userId || uid;
    verifiedEmail = sessionData?.user?.email || sessionData?.email || email;
  } catch (err) {
    console.error('[/api/auth/session] InsForge verification request failed:', err);
    return NextResponse.json(
      { error: 'Could not reach InsForge to verify token' },
      { status: 502 }
    );
  }

  if (!verifiedUid || !verifiedEmail) {
    return NextResponse.json(
      { error: 'Could not determine user identity from InsForge response' },
      { status: 401 }
    );
  }

  // ── Sign and issue the app-domain session cookie ─────────────────────────
  const cookieValue = await signSession(verifiedUid, verifiedEmail, SESSION_SECRET);

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });

  return response;
}

// ---------------------------------------------------------------------------
// DELETE — clear the session cookie on logout
// ---------------------------------------------------------------------------

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // immediate expiry
    path: '/',
  });

  return response;
}
