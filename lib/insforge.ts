import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // V23: Point directly to InsForge backend for auth.
  // The Vercel rewrite for /api/auth/* intercepts SDK login calls and routes
  // them to FastAPI (which expects a Bearer token, not credentials).
  // Custom API calls still go through Vercel via lib/api.ts ApiClient.
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://thrqylyixmoxhbtzndoe.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODcwMzR9.5ozL5Pi8y3uoUMYn19lvh7890vRrLet4QsaInC4XtPs',
});
