import { InsforgeMiddleware } from '@insforge/nextjs/middleware';

export default InsforgeMiddleware({
  baseUrl: 'https://pa5riyqv-flask.eu-central.insforge.app/p-api',
  signInUrl: '/login',
  useBuiltInAuth: false,
  publicRoutes: [
    '/', 
    '/login', 
    '/api/auth*', 
    '/auth/callback', 
    '/p-api*',
    '/api/landing*', // Public CMS content
    '/api/health'    // Health checks
  ],
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
