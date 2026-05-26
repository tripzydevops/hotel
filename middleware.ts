import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  // 1. Retrieve the session token from the cookies
  const token = request.cookies.get('sb-access-token')?.value || 
                request.cookies.get('insforge-access-token')?.value;

  const { pathname } = request.nextUrl;

  // 2. Redirect to /login if there is no token and trying to access protected paths
  if (!token && (pathname.startsWith('/dashboard') || 
                 pathname.startsWith('/admin') || 
                 pathname.startsWith('/analysis') || 
                 pathname.startsWith('/reports') ||
                 pathname === '/')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|auth|rest|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
