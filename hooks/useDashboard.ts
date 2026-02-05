import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserSettings, ScanOptions, AdminUser } from "@/types";
import { useToast } from "@/components/ui/ToastContext";

export function useDashboard(
  userId: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- Queries ---
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api.getDashboard(userId!),
    enabled: !!userId,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", userId],
    queryFn: () => api.getSettings(userId!),
    enabled: !!userId,
  });

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId!),
    enabled: !!userId,
  });

  // --- Mutations ---
  const scanMutation = useMutation({
    mutationFn: (options: ScanOptions) => api.triggerMonitor(userId!, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      queryClient.invalidateQueries({ queryKey: ["recent_sessions", userId] });
    },
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

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: UserSettings) =>
      api.updateSettings(userId!, settings),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["settings", userId], variables);
      // Settings might affect dashboard currency/display, so refresh dashboard too
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  // --- Legacy Interface Shim ---

  // Combine loading states
  const loading =
    dashboardQuery.isLoading ||
    settingsQuery.isLoading ||
    profileQuery.isLoading;

  // Combine errors
  const error = dashboardQuery.error
    ? String(dashboardQuery.error)
    : settingsQuery.error
      ? String(settingsQuery.error)
      : profileQuery.error
        ? String(profileQuery.error)
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

  const updateSettings = async (settings: UserSettings) => {
    return updateSettingsMutation.mutateAsync(settings);
  };

  const setProfile = (newProfile: AdminUser) => {
    queryClient.setQueryData(["profile", userId], newProfile);
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
    userSettings: settingsQuery.data || undefined,
    profile: profileQuery.data || null,
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
