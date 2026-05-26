import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  // Pass-through middleware since route protection is fully handled client-side
  // via the useAuth hook using client-side localStorage tokens.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|auth|rest|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
