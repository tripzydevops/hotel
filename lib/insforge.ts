import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // Point directly to InsForge backend for auth.
  // The Vercel rewrite for /api/auth/* intercepts SDK login calls and routes
  // them to FastAPI (which expects a Bearer token, not credentials).
  // Custom API calls still go through Vercel via lib/api.ts ApiClient.
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
});
