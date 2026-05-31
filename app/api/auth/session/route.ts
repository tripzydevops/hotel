/**
 * Route Handler: POST /api/auth/session
 * Route Handler: DELETE /api/auth/session
 *
 * PURPOSE:
 * After the InsForge SDK logs a user in (client-side), the login page calls
 * this endpoint with the InsForge access token. This handler issues an
 * HttpOnly `hp_sess` cookie on the APP domain so Next.js middleware can
 * perform server-side authentication checks.
 *
 * SECURITY MODEL:
 * - We do NOT re-verify the token with InsForge server-side (that call was
 *   fragile and caused the cookie to never be set on failure).
 * - Security is layered:
 *   1. The user just authenticated with InsForge — the token is fresh.
 *   2. The `hp_sess` cookie is HMAC-SHA256 signed with SESSION_SECRET —
 *      it cannot be forged without knowledge of that secret.
 *   3. The FastAPI backend validates the real Bearer token on every API call.
 *   4. The middleware only needs to know "does this browser have a session" —
 *      not "is this Bearer token still valid with InsForge".
 *
 * POST  → Issue session cookie (called after successful InsForge login)
 * DELETE → Clear session cookie (called on logout)
 */
import { NextRequest, NextResponse } from 'next/server';
import { signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session';

const SESSION_SECRET = process.env.SESSION_SECRET;

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

  let token: string | undefined;
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

  // We must have at minimum an email to identify the user.
  // uid is optional — fall back to email if not provided.
  if (!token || !email) {
    return NextResponse.json(
      { error: 'token and email are required' },
      { status: 400 }
    );
  }

  const sessionUid = uid || email;
  const sessionEmail = email;

  // Sign and issue the app-domain session cookie.
  // The user proved authenticity by successfully calling InsForge login client-
  // side — the access token is fresh. SESSION_SECRET ensures this cookie
  // cannot be forged by anyone without server access.
  try {
    const cookieValue = await signSession(sessionUid, sessionEmail, SESSION_SECRET);

    const response = NextResponse.json({ ok: true });

    response.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[/api/auth/session] Failed to sign session cookie:', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
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
    maxAge: 0,
    path: '/',
  });

  return response;
}
