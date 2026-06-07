"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { insforge } from "@/lib/insforge";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data, error } = await insforge.auth.getCurrentUser() as any;
        if (error) throw error;
        // The SDK returns { data: { user }, error } or just data.
        const currentUser = data?.user || data;
        if (!currentUser) {
          throw new Error("No user profile found in session");
        }
        setUser(currentUser);
      } catch (err) {
        console.error("Auth Load Error", err);
        // Clear the stale app-domain session cookie so we don't get trapped in a redirect loop
        try {
          await fetch("/api/auth/session", { method: "DELETE" });
        } catch (clearErr) {
          console.error("Failed to clear stale session cookie:", clearErr);
        }
      } finally {
        setIsLoaded(true);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      if (!user && pathname !== "/login") {
        setRedirecting(true);
        router.push("/login");
      }
    }
  }, [user, isLoaded, pathname, router]);

  const loading = !isLoaded || redirecting;

  return { userId: user?.id || null, loading };
}
