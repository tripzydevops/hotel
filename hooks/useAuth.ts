"use client";

import { useEffect, useState } from "react";
import { useUser } from "@insforge/nextjs";
import { useRouter, usePathname } from "next/navigation";

export function useAuth() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [redirecting, setRedirecting] = useState(false);

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
