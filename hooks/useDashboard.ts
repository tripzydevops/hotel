"use client";

import { useState, useEffect } from "react";
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

  // --- Queries ---
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api.getDashboard(),
    enabled: !!userId,
    // EXPLANATION: Polling Strategy
    // When a scan is manually triggered, we set `isPolling` to true.
    // This enables `refetchInterval` to auto-fetch data every 3 seconds.
    // This ensures the UI updates automatically when the background scan completes.

  });

  const isLoadingDashboard = dashboardQuery.isLoading;

  // PERFORMANCE: We disable these independent fetches if the dashboard 
  // response bundle (which includes profile/settings) is already in cache
  // or if the main bundle is currently being fetched.
  const hasDashboardData = !!queryClient.getQueryData(["dashboard", userId]);
  
  const {
    settings,
    updateSettings,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings(userId, !!userId && !hasDashboardData && !isLoadingDashboard);

  const {
    profile,
    setProfile,
    loading: profileLoading,
    error: profileError,
  } = useProfile(userId, !!userId && !hasDashboardData && !isLoadingDashboard);

  // EXPLANATION: Fast-Load Cache Seeding
  // When the bundled dashboard data arrives, we manually seed the React Query
  // cache for Profile and Settings. This prevents the individual hooks from
  // triggering redundant API calls, significantly speeding up the initial load.
  useEffect(() => {
    const data = dashboardQuery.data;
    if (data) {
      if (data.profile) {
        queryClient.setQueryData(["profile", userId], data.profile);
      }
      if (data.user_settings) {
        queryClient.setQueryData(["settings", userId], data.user_settings);
      }
    }
  }, [dashboardQuery.data, queryClient, userId]);

  // --- Mutations ---


  const addHotelMutation = useMutation({
    mutationFn: (variables: {
      name: string;
      location: string;
      isTarget: boolean;
      currency: string;
      serpApiId?: string;
    }) =>
      api.addHotel(
        variables.name,
        variables.location,
        variables.isTarget,
        variables.currency,
        variables.serpApiId,
      ),
    onMutate: async (newHotel) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["dashboard", userId] });

      // Snapshot the previous value
      const previousDashboard = queryClient.getQueryData(["dashboard", userId]);

      // Optimistically update to the new value
      if (previousDashboard) {
        queryClient.setQueryData(["dashboard", userId], (old: any) => ({
          ...old,
          competitors: [...(old.competitors || []), { 
            id: 'temp-id-' + Math.random(), 
            name: newHotel.name, 
            location: newHotel.location,
            is_target_hotel: newHotel.isTarget,
            created_at: new Date().toISOString()
          }]
        }));
      }

      return { previousDashboard };
    },
    onError: (err, newHotel, context: any) => {
      queryClient.setQueryData(["dashboard", userId], context.previousDashboard);
      toast.error(t("dashboard.addError") || "Failed to add hotel");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const deleteHotelMutation = useMutation({
    mutationFn: (hotelId: string) => api.deleteHotel(hotelId),
    onMutate: async (hotelId) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard", userId] });
      const previousDashboard = queryClient.getQueryData(["dashboard", userId]);

      if (previousDashboard) {
        queryClient.setQueryData(["dashboard", userId], (old: any) => ({
          ...old,
          competitors: (old.competitors || []).filter((h: any) => h.id !== hotelId)
        }));
      }

      return { previousDashboard };
    },
    onError: (err, hotelId, context: any) => {
      queryClient.setQueryData(["dashboard", userId], context.previousDashboard);
      toast.error(t("dashboard.removeError") || "Failed to delete hotel");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const updateHotelMutation = useMutation({
    mutationFn: (variables: { hotelId: string; updates: any }) =>
      api.updateHotel(variables.hotelId, variables.updates),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard", userId] });
      const previousDashboard = queryClient.getQueryData(["dashboard", userId]);

      if (previousDashboard) {
        queryClient.setQueryData(["dashboard", userId], (old: any) => {
          if (!old) return old;
          
          const isSettingTarget = variables.updates.is_target_hotel === true;
          
          if (isSettingTarget) {
            // Find the new target from either competitors or current target (unlikely to be target already but safe)
            const allHotels = [...(old.competitors || []), old.target_hotel].filter(Boolean);
            const newTarget = allHotels.find(h => h.id === variables.hotelId);
            
            if (!newTarget) return old;

            // New competitors = all hotels except the new target, marked as NOT target
            const newCompetitors = allHotels
              .filter(h => h.id !== variables.hotelId)
              .map(h => ({ ...h, is_target_hotel: false }));

            return {
              ...old,
              target_hotel: { ...newTarget, is_target_hotel: true },
              competitors: newCompetitors,
            };
          }

          // Normal update for a single hotel (name, location, etc.)
          const updateHotelInList = (list: any[]) => 
            (list || []).map(h => h.id === variables.hotelId ? { ...h, ...variables.updates } : h);

          return {
            ...old,
            target_hotel: old.target_hotel?.id === variables.hotelId 
              ? { ...old.target_hotel, ...variables.updates } 
              : old.target_hotel,
            competitors: updateHotelInList(old.competitors),
          };
        });
      }

      return { previousDashboard };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(["dashboard", userId], context.previousDashboard);
      toast.error(t("common.errorTitle") || "Update failed");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
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

  const handleUpdateHotel = async (hotelId: string, updates: any) => {
    return updateHotelMutation.mutateAsync({ hotelId, updates });
  };

  const handleSetTargetHotel = async (hotelId: string) => {
    try {
      const currentData = dashboardQuery.data;
      // If there is an existing target, unset it in the database first
      if (currentData?.target_hotel) {
        await api.updateHotel(currentData.target_hotel.id, { is_target_hotel: false });
      }
      return handleUpdateHotel(hotelId, { is_target_hotel: true });
    } catch (error) {
      console.error("Failed to set target hotel:", error);
      throw error;
    }
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
    isRefreshing: dashboardQuery.isRefetching,
    fetchData,
    handleAddHotel,
    handleDeleteHotel,
    handleUpdateHotel,
    handleSetTargetHotel,
    updateSettings,
    setProfile,
  };
}
