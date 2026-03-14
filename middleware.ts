import { InsforgeMiddleware } from '@insforge/nextjs/middleware';

export const middleware = InsforgeMiddleware({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
