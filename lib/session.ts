/**
 * lib/session.ts — App-Domain Session Cookie Utilities
 *
 * Signs and verifies the `hp_sess` HttpOnly cookie issued after InsForge login.
 *
 * IMPORTANT: Uses ONLY Web Crypto API + atob/btoa — NO Buffer, NO Node.js APIs.
 * This is required because Next.js middleware runs in the Edge Runtime where
 * Buffer.from(...).buffer returns a SharedArrayBuffer (not ArrayBuffer),
 * which causes crypto.subtle.verify to silently throw and return null,
 * causing the middleware to block all authenticated users.
 */

export const SESSION_COOKIE = 'hp_sess';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  uid: string;
  email: string;
  exp: number; // Unix timestamp (seconds)
}

// ---------------------------------------------------------------------------
// Edge-safe base64url helpers (atob/btoa — no Buffer dependency)
// ---------------------------------------------------------------------------

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromB64url(str: string): ArrayBuffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Return a plain ArrayBuffer slice — not a SharedArrayBuffer
  return bytes.buffer.slice(0);
}

// ---------------------------------------------------------------------------
// HMAC key helper
// ---------------------------------------------------------------------------

async function getKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer.slice(0) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a signed cookie value.
 * Format: <b64url(JSON payload)>.<b64url(HMAC-SHA256 signature)>
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

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadBuf = payloadBytes.buffer.slice(0) as ArrayBuffer;
  const payloadB64 = b64url(payloadBuf);

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, payloadBuf);

  return `${payloadB64}.${b64url(sig)}`;
}

/**
 * Verifies and decodes a session cookie value.
 * Returns the payload if valid and not expired, null otherwise.
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

    const payloadBuf = fromB64url(payloadB64);
    const sigBuf = fromB64url(sigB64);

    const key = await getKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, payloadBuf);
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(new TextDecoder().decode(payloadBuf));

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (err) {
    console.error('[session] verifySession error:', err);
    return null;
  }
}
