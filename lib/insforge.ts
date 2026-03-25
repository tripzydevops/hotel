import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // KAİZEN: Robust Direct/Proxy split.
  // Browser calls use same-origin proxy (window.location.origin) to bypass CORS.
  // Server calls use direct backend URL to bypass Vercel loop limits.
  baseUrl: typeof window !== 'undefined' 
    ? window.location.origin 
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app'),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
