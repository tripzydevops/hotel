import { createClient } from '@insforge/sdk';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side same-origin proxy to prevent CSRF and SameSite cookie blocks
    return window.location.origin;
  }
  // Server-side direct endpoint mapping
  return process.env.NEXT_PUBLIC_SUPABASE_URL as string;
};

export const insforge = createClient({
  // Use same-origin proxy on the client side to avoid CSRF and CORS errors.
  // Custom FastAPI calls still go through Vercel via lib/api.ts ApiClient.
  baseUrl: getBaseUrl(),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
});
