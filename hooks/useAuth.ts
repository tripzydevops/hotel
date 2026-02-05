import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  return { userId };
}
