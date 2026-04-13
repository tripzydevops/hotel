"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

/**
 * Hook to track active scan tasks for the current user's hotels.
 * Returns a set of hotel IDs that currently have a 'pending' scan task.
 */
export function useActiveScans(userId: string | null) {
  const [activeHotelIds, setActiveHotelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const fetchActiveScans = async () => {
      try {
        const data = await api.getActiveTasks();

        if (isMounted) {
          const ids = new Set<string>(Array.isArray(data) ? data : []);
          setActiveHotelIds(ids);
        }
      } catch (err) {
        console.error("[useActiveScans] Error fetching active scans:", err);
      }
    };

    // Initial fetch
    fetchActiveScans();

    // Poll every 10 seconds
    const interval = setInterval(fetchActiveScans, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userId]);

  return {
    activeHotelIds: [...activeHotelIds],
    isAnyScanActive: activeHotelIds.size > 0
  };
}
