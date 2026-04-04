import { createClient } from '@insforge/sdk';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup');
  const isPublicPage = url.pathname === '/' || url.pathname === '/about' || url.pathname.startsWith('/api/');

  // Skip middleware for public assets
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.includes('.') ||
    url.pathname.startsWith('/static')
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Create a middleware-specific client that forwards the request's cookies
  const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ik_569a919326e5a606990494541539bd13.supabase.insforge.app',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODcwMzR9.5ozL5Pi8y3uoUMYn19lvh7890vRrLet4QsaInC4XtPs',
    fetch: (input, init) => {
      // Forward all cookies from the incoming request to the Insforge backend
      const headers = new Headers(init?.headers);
      const cookieStr = request.headers.get('cookie');
      if (cookieStr) {
        headers.set('cookie', cookieStr);
      }
      return fetch(input, { ...init, headers });
    },
  });

  try {
    // Check current user session
    const { data, error } = await insforge.auth.getCurrentUser();
    const user = data?.user;

    // If no user and trying to access a protected page, redirect to login
    if (!user && !isAuthPage && !isPublicPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // If user is logged in and trying to access auth pages, redirect to home
    if (user && isAuthPage) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } catch (e) {
    console.error('Middleware auth error:', e);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
