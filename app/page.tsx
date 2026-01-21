"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BentoGrid from "@/components/BentoGrid";
import TargetHotelTile from "@/components/TargetHotelTile";
import CompetitorTile from "@/components/CompetitorTile";
import AddHotelModal from "@/components/AddHotelModal";
import SettingsModal from "@/components/SettingsModal";
import { Bell, RefreshCw, Plus, Settings } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardData, UserSettings } from "@/types";

// Placeholder User ID for prototype
const USER_ID = "00000000-0000-0000-0000-000000000000";

export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddHotelOpen, setIsAddHotelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | undefined>(
    undefined,
  );

  const fetchData = async () => {
    try {
      const dashboardData = await api.getDashboard(USER_ID);
      setData(dashboardData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.triggerMonitor(USER_ID);
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
  ) => {
    await api.addHotel(USER_ID, name, location, isTarget);
    await fetchData();
  };

  const handleSaveSettings = async (settings: UserSettings) => {
    await api.updateSettings(USER_ID, settings);
    setUserSettings(settings);
    // Refresh to check if any immediate alerts
    handleRefresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--soft-gold)]"></div>
      </div>
    );
  }

  if (!data) return null;

  const targetPrice = data.target_hotel?.price_info?.current_price || 0;

  return (
    <div className="min-h-screen pb-12">
      <Header />

      <AddHotelModal
        isOpen={isAddHotelOpen}
        onClose={() => setIsAddHotelOpen(false)}
        onAdd={handleAddHotel}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onSave={handleSaveSettings}
      />

      {/* Main Content */}
      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Rate Monitor
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Track competitor pricing in real-time
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Alerts Badge */}
            <button className="relative p-3 glass rounded-xl hover:bg-white/10 transition-colors">
              <Bell className="w-5 h-5 text-white" />
              {data.unread_alerts_count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {data.unread_alerts_count}
                </span>
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 glass rounded-xl hover:bg-white/10 transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 glass rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-5 h-5 text-white ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>

            {/* Add Competitor */}
            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="btn-gold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Hotel</span>
            </button>
          </div>
        </div>

        {/* Bento Grid Dashboard */}
        <BentoGrid>
          {/* Target Hotel - Large Tile */}
          {data.target_hotel && data.target_hotel.price_info && (
            <TargetHotelTile
              name={data.target_hotel.name}
              location={data.target_hotel.location}
              currentPrice={data.target_hotel.price_info.current_price}
              previousPrice={data.target_hotel.price_info.previous_price}
              currency={data.target_hotel.price_info.currency}
              trend={data.target_hotel.price_info.trend}
              changePercent={data.target_hotel.price_info.change_percent}
              lastUpdated="2 min ago"
            />
          )}

          {/* Competitor Tiles */}
          {data.competitors.map((competitor) => {
            const isUndercut =
              competitor.price_info &&
              competitor.price_info.current_price < targetPrice;

            return (
              <CompetitorTile
                key={competitor.id}
                name={competitor.name}
                currentPrice={competitor.price_info?.current_price || 0}
                previousPrice={competitor.price_info?.previous_price}
                currency={competitor.price_info?.currency || "USD"}
                trend={competitor.price_info?.trend || "stable"}
                changePercent={competitor.price_info?.change_percent || 0}
                isUndercut={isUndercut}
              />
            );
          })}
        </BentoGrid>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-[var(--soft-gold)]">
              {
                data.competitors.filter(
                  (c) =>
                    c.price_info && c.price_info.current_price < targetPrice,
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)]">Undercutting You</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-[#0ea5e9]">
              {
                data.competitors.filter((c) => c.price_info?.trend === "down")
                  .length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)]">Prices Dropped</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">
              $
              {Math.round(
                data.competitors.reduce(
                  (sum, c) => sum + (c.price_info?.current_price || 0),
                  0,
                ) / data.competitors.length,
              )}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Avg Competitor</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data.competitors.length + 1}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Hotels Tracked</p>
          </div>
        </div>
      </main>
    </div>
  );
}
