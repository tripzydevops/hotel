import { createClient } from '@insforge/sdk';

// Using existing Supabase variable names for compatibility in Vercel
export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ik_569a919326e5a606990494541539bd13.supabase.insforge.app',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODcwMzR9.5ozL5Pi8y3uoUMYn19lvh7890vRrLet4QsaInC4XtPs',
});
