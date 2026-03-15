import { auth } from "@insforge/nextjs/server";
import DashboardClient from "./DashboardClient";
import { DashboardData } from "@/types";
import { headers } from "next/headers";

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

  // Resolve API Base URL for server-to-server call
  // We use localhost in local dev and the full InsForge URL in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const baseUrl = isProduction 
    ? (process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || 'https://pa5riyqv.eu-central.insforge.app')
    : 'http://localhost:8000';

  let initialData: DashboardData | null = null;
  
  try {
    const params = effectiveUserId ? `?user_id=${effectiveUserId}` : "";
    const apiPath = '/api/dashboard';
    
    // EXPLANATION: Reliable Server-to-Server Routing
    // In production, we MUST hit the local deployment to ensure cookies/auth and rewrites resolve.
    // If VERCEL_URL is missing, we fallback to the known InsForge base.
    const effectiveBaseUrl = (isProduction && process.env.VERCEL_URL) 
      ? `https://${process.env.VERCEL_URL}`
      : baseUrl;

    const res = await fetch(`${effectiveBaseUrl}${apiPath}${params}`, {
       headers: {
         "Authorization": `Bearer ${token}`,
         "Content-Type": "application/json"
       },
       next: { revalidate: 0 } // Ensure fresh data on server-side render
    });

    if (res.ok) {
       initialData = await res.json();
    } else {
       console.error("[ServerComponent] Failed to fetch dashboard data:", await res.text());
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
