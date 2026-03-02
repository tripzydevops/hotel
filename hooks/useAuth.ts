"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        setUserId(session.user.id);
        setLoading(false);
      } else if (pathname !== "/login") {
        router.push("/login");
        // Keep loading true while redirecting
      } else {
        setLoading(false);
      }
    };
    getSession();
  }, [supabase.auth, pathname, router]);

  return { userId, loading };
}
