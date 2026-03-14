import { createAuthRouteHandlers } from '@insforge/nextjs/api';

const handlers = createAuthRouteHandlers({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
