"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function useAdminGuard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push("/login"); // Or admin login
            return;
        }

        // Check profile for admin role or email whitelist
        // For MVP, checking specific email or metadata
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role") // content?
          .eq("user_id", session.user.id)
          .single();
          
        // Hardcoded admin email for safety if role missing
        const isAdminEmail = session.user.email === "admin@hotel.plus" || session.user.email?.endsWith("@tripzy.travel");
        
        // This is Client-Side UI Guard only. Backend must enforce real security.
        if (profile?.role === "admin" || isAdminEmail || session.user.email === "elif@tripzy.travel") {
            setAuthorized(true);
        } else {
            console.warn("Unauthorized Admin Access Attempt", session.user.id);
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
  }, [router]);

  return { loading, authorized };
}
