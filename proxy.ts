import { InsforgeMiddleware } from '@insforge/nextjs/middleware';

export const proxy = InsforgeMiddleware({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app',
  publicRoutes: ['/', '/login', '/signup', '/api(.*)', '/pricing', '/contact', '/about'],
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
