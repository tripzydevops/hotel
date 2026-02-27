import { createBrowserClient } from "@supabase/ssr";

let browserService: any = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a dummy client for build time if env vars are missing
    if (typeof window !== "undefined") {
      console.warn("Supabase credentials missing! Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.");
    }
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
    } as any;
  }

  // Singleton instance for browser-side usage
  if (typeof window !== "undefined") {
    if (!browserService) {
      browserService = createBrowserClient(url, key);
    }
    return browserService;
  }

  return createBrowserClient(url, key);
}

