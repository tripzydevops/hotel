import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  baseUrl: 'https://pa5riyqv.insforge.site',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
