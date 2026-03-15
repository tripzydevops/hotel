import { auth } from "@insforge/nextjs/server";
import DashboardClient from "./DashboardClient";
import { DashboardData } from "@/types";
import { headers, cookies } from "next/headers";

// EXPLANATION: Server Component Optimization (Phase 7)
// This page now fetches data on the server, eliminating the initial loading flicker 
// and reducing the client-side JavaScript sent to the browser.
// It passess the fetched data to DashboardClient which hydrates the React Query cache.

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { userId, token } = await auth();
  const impersonateId = typeof searchParams.impersonate === 'string' ? searchParams.impersonate : null;
  
  if (!userId && !impersonateId) {
     return <div>Redirecting to login...</div>;
  }

  // Determine effective User ID
  const effectiveUserId = impersonateId || userId;

  // Resolve API Base URL for server-to-server call.
  // We use the application's own host and the /p-api proxy path to ensure
  // consistent routing and bypass direct origin 403 blocks.
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const host = (await headers()).get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = isProduction 
    ? `${protocol}://${host}/p-api`
    : 'http://localhost:8000';

  let initialData: DashboardData | null = null;
  
  try {
    const params = effectiveUserId ? `?user_id=${effectiveUserId}` : "";
    const allCookies = (await cookies()).toString();
    const fetchUrl = `${baseUrl}/api/dashboard${params}`;
    console.log(`[ServerFetch] Routing via Proxy: ${fetchUrl}`);
    
    const res = await fetch(fetchUrl, {
       headers: {
         "Authorization": `Bearer ${token}`,
         "Cookie": allCookies,
         "Content-Type": "application/json",
         "x-debug-source": "server-fetch"
       },
       next: { revalidate: 0 }
    });

    console.log(`[ServerFetch] Status: ${res.status} (${res.ok ? 'OK' : 'FAIL'})`);

    if (res.ok) {
       initialData = await res.json();
    } else {
       const text = await res.text();
       console.error("[ServerComponent] Failed to fetch dashboard data:", text.slice(0, 200));
    }
  } catch (err) {
    console.error("[ServerComponent] Error fetching dashboard data:", err);
  }

  return (
    <DashboardClient 
      userId={userId} 
      initialData={initialData} 
      impersonateId={impersonateId}
    />
  );
}
