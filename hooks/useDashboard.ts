"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ScanOptions } from "@/types";
import { useToast } from "@/components/ui/ToastContext";
import { useSettings } from "@/hooks/useSettings";
import { useProfile } from "@/hooks/useProfile";

export function useDashboard(
  userId: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // --- Composed Hooks ---
  const {
    settings,
    updateSettings,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings(userId);

  const {
    profile,
    setProfile,
    loading: profileLoading,
    error: profileError,
  } = useProfile(userId);

  // --- Queries ---
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api.getDashboard(userId!),
    enabled: !!userId,
    // EXPLANATION: Polling Strategy
    // When a scan is manually triggered, we set `isPolling` to true.
    // This enables `refetchInterval` to auto-fetch data every 3 seconds.
    // This ensures the UI updates automatically when the background scan completes.
    refetchInterval: isPolling ? 3000 : false,
  });

  // --- Mutations ---
  const scanMutation = useMutation({
    mutationFn: (options: ScanOptions) => api.triggerMonitor(userId!, options),
    onSuccess: () => {
      // Immediate invalidation to clear/refresh data
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      queryClient.invalidateQueries({ queryKey: ["recent_sessions", userId] });

      // EXPLANATION: Async Update Handling
      // The backend scan runs asynchronously. To reflect the new data without
      // a manual page refresh, we enable polling for a fixed duration (20s).
      // This gives the backend enough time to finish the scan.
      setIsPolling(true);
      setTimeout(() => setIsPolling(false), 20000);
      toast.success(t("dashboard.scanStarted") || "Scan started successfully");
    },
    onError: (error) => {
      console.error("Scan failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start scan");
    },
  });
  });

  const addHotelMutation = useMutation({
    mutationFn: (variables: {
      name: string;
      location: string;
      isTarget: boolean;
      currency: string;
      serpApiId?: string;
    }) =>
      api.addHotel(
        userId!,
        variables.name,
        variables.location,
        variables.isTarget,
        variables.currency,
        variables.serpApiId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const deleteHotelMutation = useMutation({
    mutationFn: (hotelId: string) => api.deleteHotel(hotelId),
    onSuccess: () => {
      toast.success(t("dashboard.removeSuccess"));
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
    onError: (error) => {
      console.error("Failed to delete hotel:", error);
      toast.error(t("dashboard.removeError"));
    },
  });

  // --- Legacy Interface Shim ---

  // Combine loading states
  const loading = dashboardQuery.isLoading || settingsLoading || profileLoading;

  // Combine errors
  const error = dashboardQuery.error
    ? String(dashboardQuery.error)
    : settingsError
      ? String(settingsError)
      : profileError
        ? String(profileError)
        : null;

  const handleScan = async (options: ScanOptions) => {
    return scanMutation.mutateAsync(options);
  };

  const handleAddHotel = async (
    name: string,
    location: string,
    isTarget: boolean,
    currency: string,
    serpApiId?: string,
  ) => {
    return addHotelMutation.mutateAsync({
      name,
      location,
      isTarget,
      currency,
      serpApiId,
    });
  };

  const handleDeleteHotel = async (hotelId: string) => {
    if (!userId || !confirm(t("dashboard.removeConfirm"))) return;
    deleteHotelMutation.mutate(hotelId);
  };

  const fetchData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] }),
      queryClient.invalidateQueries({ queryKey: ["settings", userId] }),
      queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
    ]);
  };

  return {
    data: dashboardQuery.data || null,
    userSettings: settings,
    profile,
    loading,
    error,
    isRefreshing: dashboardQuery.isRefetching || scanMutation.isPending,
    fetchData,
    handleScan,
    handleAddHotel,
    handleDeleteHotel,
    updateSettings,
    setProfile,
  };
}
