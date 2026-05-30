/**
 * Server-Side InsForge Auth Client (using @supabase/ssr)
 *
 * InsForge is the project's database & auth backend (Supabase-compatible).
 * The browser uses the @insforge/sdk (lib/insforge.ts).
 * This file provides the server-side equivalent for Edge/Node contexts.
 *
 * WHY TWO CLIENTS?
 *   - @insforge/sdk  → reads auth tokens from localStorage (browser only)
 *   - @supabase/ssr  → reads auth tokens from HttpOnly cookies (server/Edge)
 *
 * Both point at the same NEXT_PUBLIC_SUPABASE_URL / InsForge backend.
 * The session cookies set by the InsForge SDK on login are read here.
 *
 * USE IN:
 *   - Next.js Route Handlers (app/api/...)
 *   - Server Components
 *   - Server Actions
 *
 * COMPLIANCE: Server-side auth decisions cannot be bypassed by client JS.
 * This closes the IDOR / auth bypass gaps flagged in the SOC 2 audit.
 *
 * DO NOT import in Client Components ("use client"). Use @/lib/insforge there.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll() called from a Server Component — cookies are read-only.
            // The middleware will handle cookie refresh instead.
          }
        },
      },
    }
  );
}

/**
 * Convenience helper: get the authenticated user from a server context.
 * Returns null if not authenticated (does NOT throw).
 *
 * @example
 * // In a Route Handler:
 * const user = await getServerUser();
 * if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function getServerUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
