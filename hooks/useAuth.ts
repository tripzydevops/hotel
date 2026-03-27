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
        const { data } = await insforge.auth.getCurrentUser();
        setUser(data);
      } catch (err) {
        console.error("Auth Load Error", err);
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
