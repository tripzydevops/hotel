import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // HARD-FORCED V6 (HYBRID): 
  // Browser hits the Vercel rewrites (window.location.origin) to avoid CORS.
  // Server hits the direct proxy to avoid Vercel internal loop 404s.
  baseUrl: typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://pa5riyqv.insforge.site',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIwNDB9.H4Unbw_QgpvcAV-qytM9WUkk0s74So1Dnj318lt_2ZQ',
});
