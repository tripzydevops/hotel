"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { api } from "@/lib/api";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        // 1. Check basic authentication session with automatic refresh
        const { data: sessionData } = await insforge.auth.refreshSession();
        // In this version, refreshSession returns the user directly in data if it exists
        const authUser = sessionData; 
        
        if (!authUser?.user) {
          console.warn("[AdminGuard] No active session, redirecting to login");
          router.push("/login");
          return;
        }

        // 2. Fetch enriched profile for role verification
        let profile = null;
        try {
          profile = await api.getProfile();
        } catch (err: any) {
          console.error("[AdminGuard] Profile fetch failed:", err);
          
          // CRITICAL: If the token is expired/invalid, we MUST redirect to login
          // and not rely on the email whitelist with a stale session.
          if (err.message?.includes("Invalid or expired session token") || err.message?.includes("401")) {
             console.warn("[AdminGuard] Session invalid, clearing and redirecting.");
             await insforge.auth.signOut();
             router.push("/login");
             return;
          }
          // For other errors (500, network), we fallback to email whitelist for safety
          profile = null;
        }

        const combinedUser = { ...authUser, profile };
        setUser(combinedUser);

        // 3. Authorization Logic
        const role = (profile?.role || "").toLowerCase();
        const email = (authUser.user?.email || "").toLowerCase();

        const isAdminRole = ["admin", "market_admin", "market admin"].includes(role);
        const isAdminEmail = [
          "asknsezen@gmail.com",
          "askinsezen@gmail.com",
          "tripzydevops@gmail.com"
        ].includes(email);

        const isAuthorized = isAdminRole || isAdminEmail;

        if (isAuthorized) {
          console.info("[AdminGuard] Authorized access for:", email);
          setAuthorized(true);
        } else {
          console.warn("[AdminGuard] Unauthorized access attempt:", email, "Role:", role);
          router.push("/");
        }
      } catch (err) {
        console.error("[AdminGuard] Critical Authorization Error:", err);
        router.push("/");
      } finally {
        setIsLoaded(true);
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  return { loading: loading || !isLoaded, authorized };
}
