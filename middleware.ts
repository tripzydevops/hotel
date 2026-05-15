import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  // NUCLEAR BYPASS: Disabling middleware to find the redirect source.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|auth|rest|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
