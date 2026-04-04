"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserSettings } from "@/types";

export function useSettings(userId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings", userId],
    queryFn: () => api.getSettings(),
    enabled: !!userId && enabled,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: UserSettings) =>
      api.updateSettings(settings),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["settings", userId], variables);
      // Settings might affect dashboard currency/display, so refresh dashboard too
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      // Profile also contains next_scan_at which depends on frequency
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });

  return {
    settings: settingsQuery.data || undefined,
    loading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings: (settings: UserSettings) =>
      updateSettingsMutation.mutateAsync(settings),
    isUpdating: updateSettingsMutation.isPending,
  };
}
