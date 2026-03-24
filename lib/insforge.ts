import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
