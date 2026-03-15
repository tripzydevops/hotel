import { createClient } from '@insforge/sdk';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const REMOTE_BASE = (isBrowser && isProd) 
  ? (window.location.origin + '/p-api') 
  : 'https://pa5riyqv-flask.eu-central.insforge.app/api';

export const insforge = createClient({
  baseUrl: REMOTE_BASE,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
