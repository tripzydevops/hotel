import { createClient } from '@insforge/sdk';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

const REMOTE_BASE = typeof window !== "undefined" 
  ? window.location.origin 
  : (process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : "http://localhost:3000");

export const insforge = createClient({
  baseUrl: REMOTE_BASE,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const client = insforge; // Backward compatibility
