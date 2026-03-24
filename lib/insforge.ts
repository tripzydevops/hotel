import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // KAİZEN: Use relative origin to leverage same-origin proxying via next.config.ts.
  // This eliminates CORS preflight issues entirely in production.
  baseUrl: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
