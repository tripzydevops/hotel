/**
 * lib/session.ts — App-Domain Session Cookie Utilities
 *
 * Signs and verifies the `hp_sess` HttpOnly cookie that is issued by
 * app/api/auth/session/route.ts after a successful InsForge login.
 *
 * WHY THIS EXISTS:
 * InsForge sets its own httpOnly refresh cookie on the InsForge domain, not
 * the app domain. Next.js middleware can only see cookies on the app domain.
 * This module creates a second, app-domain session cookie so the middleware
 * can perform real server-side authentication checks.
 *
 * SECURITY:
 * - HMAC-SHA256 signed with SESSION_SECRET (server-side env var only)
 * - Cookie is HttpOnly + Secure + SameSite=Lax → not readable by JS
 * - Payload contains expiry — middleware rejects expired sessions
 * - Uses Web Crypto API (works in both Edge runtime and Node.js)
 */

export const SESSION_COOKIE = 'hp_sess';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  uid: string;
  email: string;
  exp: number; // Unix timestamp seconds
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromB64url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a signed cookie value for the given user.
 * Format: <b64url_payload>.<b64url_hmac>
 */
export async function signSession(
  uid: string,
  email: string,
  secret: string
): Promise<string> {
  const payload: SessionPayload = {
    uid,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64url(new TextEncoder().encode(payloadStr).buffer as ArrayBuffer);

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64).buffer as ArrayBuffer
  );

  return `${payloadB64}.${b64url(sig)}`;
}

/**
 * Verifies and decodes a session cookie value.
 * Returns the payload if valid, null if tampered or expired.
 */
export async function verifySession(
  cookieValue: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const dotIdx = cookieValue.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const payloadB64 = cookieValue.slice(0, dotIdx);
    const sigB64 = cookieValue.slice(dotIdx + 1);

    // Verify signature
    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(sigB64).buffer as ArrayBuffer,
      new TextEncoder().encode(payloadB64).buffer as ArrayBuffer
    );
    if (!valid) return null;

    // Decode payload
    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(fromB64url(payloadB64))
    );

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
