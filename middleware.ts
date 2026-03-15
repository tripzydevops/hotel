import { InsforgeMiddleware } from '@insforge/nextjs/middleware';

export default InsforgeMiddleware({
  baseUrl: (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
    ? 'https://pa5riyqv-flask.eu-central.insforge.app/api'
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app'),
  signInUrl: '/login',
  useBuiltInAuth: false,
  publicRoutes: ['/', '/login', '/api/auth*', '/auth/callback', '/p-api*'],
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
