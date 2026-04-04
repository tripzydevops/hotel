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

  // Define API endpoint for session verification
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ik_569a919326e5a606990494541539bd13.supabase.insforge.app';
  const apiEndpoint = `${baseUrl.replace(/\/$/, '')}/api/auth/sessions/current`;

  try {
    // Perform manual session verification using native fetch
    // This bypasses the SDK to avoid dynamic code evaluation errors in Edge Runtime
    const authResponse = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'cookie': request.headers.get('cookie') || '',
        'Accept': 'application/json',
      },
    });

    if (authResponse.ok) {
      const data = await authResponse.json();
      const user = data?.user;

      // Logic for authenticated users
      if (user && isAuthPage) {
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Logic for unauthenticated users accessing protected routes
      if (!user && !isAuthPage && !isPublicPage) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } else {
      // Backend returned an error (e.g. 401 Unauthorized)
      if (!isAuthPage && !isPublicPage) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  } catch (e) {
    console.error('Middleware auth verification failed:', e);
    // In case of error (e.g. timeout), default to protecting sensitive routes
    if (!isAuthPage && !isPublicPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
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
