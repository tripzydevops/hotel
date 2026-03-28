import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // HARD-FORCED V8 (DASHBOARD ALIGNMENT): 
  // Using the validated .site URL and canonical 'H4Unbw...' key.
  baseUrl: typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://pa5riyqv.eu-central.insforge.site',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODcwMzR9.5ozL5Pi8y3uoUMYn19lvh7890vRrLet4QsaInC4XtPs',
});
