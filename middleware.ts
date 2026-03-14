import { InsforgeMiddleware } from '@insforge/nextjs/middleware';

export default InsforgeMiddleware({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app',
  publicRoutes: ['/((?!dashboard|admin|profile|settings).*)'], // Protect dashboard, admin, etc.
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
