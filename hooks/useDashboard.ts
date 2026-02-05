import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DashboardData, UserSettings, ScanOptions } from "@/types";
import { useToast } from "@/components/ui/ToastContext";

export function useDashboard(userId: string | null, t: any) {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | undefined>(undefined);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const [dashboardData, settings, userProfile] = await Promise.all([
        api.getDashboard(userId),
        api.getSettings(userId),
        api.getProfile(userId),
      ]);

      setData(dashboardData);
      setUserSettings(settings);
      setProfile(userProfile);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setError(t("common.loadingError") || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, fetchData]);

  const handleScan = async (options: ScanOptions) => {
    if (!userId) return;
    setIsRefreshing(true);
    try {
      await api.triggerMonitor(userId, options);
      await fetchData();
    } catch (error) {
      console.error("Failed to refresh monitor:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddHotel = async (
    name: string,
    location: string,
    isTarget: boolean,
    currency: string,
    serpApiId?: string
  ) => {
    if (!userId) return;
    await api.addHotel(userId, name, location, isTarget, currency, serpApiId);
    await fetchData();
  };

  const handleDeleteHotel = async (hotelId: string) => {
    if (!userId || !confirm(t("dashboard.removeConfirm"))) return;
    try {
      await api.deleteHotel(hotelId);
      toast.success(t("dashboard.removeSuccess"));
      await fetchData();
    } catch (error) {
      console.error("Failed to delete hotel:", error);
      toast.error(t("dashboard.removeError"));
    }
  };

  const updateSettings = async (settings: UserSettings) => {
    if (!userId) return;
    await api.updateSettings(userId, settings);
    setUserSettings(settings);
  };

  return {
    data,
    userSettings,
    profile,
    loading,
    error,
    isRefreshing,
    fetchData,
    handleScan,
    handleAddHotel,
    handleDeleteHotel,
    updateSettings,
    setProfile, // Exposed for subscription updates
  };
}
