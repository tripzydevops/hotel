import { createClient } from '@insforge/sdk';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || 
               process.env.VERCEL_ENV === 'production' ||
               (isBrowser && 
                !window.location.hostname.includes('localhost') && 
                !window.location.hostname.includes('127.0.0.1'));

export const GATEWAY_URL = 'https://pa5riyqv-flask.eu-central.insforge.app/api';

export const insforge = createClient({
  baseUrl: (isBrowser && isProd) 
    ? (window.location.origin + '/p-api') 
    : GATEWAY_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
