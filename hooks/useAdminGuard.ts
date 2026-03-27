"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data } = await insforge.auth.getCurrentUser();
        setUser(data);
      } catch (err) {
        console.error("Admin Guard Load Error", err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isLoaded) return;
      
      try {
        if (!user) {
          router.push("/login"); // Or admin login
          return;
        }

        // Determine role from SDK profile metadata if present, or just use email checks
        const role = (user.profile as any)?.role?.toLowerCase() || "";

        // Hardcoded admin email for safety if role missing
        const userEmail = user.email?.toLowerCase() || "";
        const isAdminEmail =
          userEmail === "asknsezen@gmail.com" ||
          userEmail === "askinsezen@gmail.com" ||
          userEmail === "tripzydevops@gmail.com";

        // This is Client-Side UI Guard only. Backend must enforce real security.
        const isRoleAdmin =
          role === "admin" ||
          role === "market_admin" ||
          role === "market admin";

        if (
          isRoleAdmin ||
          isAdminEmail
        ) {
          setAuthorized(true);
        } else {
          console.warn("Unauthorized Admin Access Attempt", user.id);
          router.push("/");
        }
      } catch (e) {
        console.error("Admin Guard Error", e);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router, user, isLoaded]);

  return { loading: loading || !isLoaded, authorized };
}
