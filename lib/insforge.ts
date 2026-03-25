import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  // HARD-FORCED V8 (DASHBOARD ALIGNMENT): 
  // Using the validated .app URL and canonical 'H4Unbw...' key from your settings.
  baseUrl: typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://pa5riyqv.insforge.dev',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIwNDB9.H4Unbw_QgpvcAV-qytM9WUkk0s74So1Dnj318lt_2ZQ',
});
