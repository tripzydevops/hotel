import { createClient } from '@insforge/sdk';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

export const insforge = createClient({
  baseUrl: (isBrowser && isProd) 
    ? (window.location.origin + '/p-api') 
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app'),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
