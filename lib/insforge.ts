import { createClient } from '@insforge/sdk';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const REMOTE_BASE = 'https://pa5riyqv.insforge.site';

export const insforge = createClient({
  baseUrl: REMOTE_BASE,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
