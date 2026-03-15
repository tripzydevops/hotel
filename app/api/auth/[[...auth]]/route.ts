import { createAuthRouteHandlers } from '@insforge/nextjs/api';

const handlers = createAuthRouteHandlers({
  baseUrl: (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
    ? 'https://pa5riyqv-flask.eu-central.insforge.app/api'
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app'),
});

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
