import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require authentication
  const publicPaths = ["/", "/about", "/pricing", "/contact", "/login", "/auth", "/help", "/api/landing/config"];
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname === path || 
    request.nextUrl.pathname.startsWith(path + "/")
  );

  if (!user && !isPublicPath) {
    // no user, respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Connectivity: If user is logged in and visits the root, send them to the dashboard
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Admin Route Protection
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const userEmail = user?.email?.toLowerCase() || "";
    // KAİZEN: Standardized Admin Whitelist (Feb 2026)
    // Matches useAdminGuard.ts and backend profile_service.py bypasses
    const isWhitelistedAdmin = 
      ["tripzydevops@gmail.com", "asknsezen@gmail.com", "askinsezen@gmail.com", "selcuk@rate-sentinel.com", "yusuf@tripzy.travel", "elif@tripzy.travel", "admin@hotel.plus"].includes(userEmail) ||
      userEmail.endsWith("@hotel.plus") ||
      userEmail.endsWith("@tripzy.travel");

    if (!isWhitelistedAdmin) {
      // Redirect unauthorized users to dashboard
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
