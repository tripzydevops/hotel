"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BentoGrid from "@/components/BentoGrid";
import TargetHotelTile from "@/components/TargetHotelTile";
import CompetitorTile from "@/components/CompetitorTile";
import AddHotelModal from "@/components/AddHotelModal";
import SettingsModal from "@/components/SettingsModal";
import { Bell, RefreshCw, Plus, Settings, History } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import { DashboardData, UserSettings } from "@/types";
import RecentSearches from "@/components/RecentSearches";
import SkeletonTile from "@/components/SkeletonTile";
import ScanHistory from "@/components/ScanHistory";
import Link from "next/link";

export default function Dashboard() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddHotelOpen, setIsAddHotelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | undefined>(
    undefined,
  );


  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        // Redirect to login if no session
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;
    try {
      setError(null);
      const dashboardData = await api.getDashboard(userId);
      setData(dashboardData);

      const settings = await api.getSettings(userId);
      setUserSettings(settings);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setError("Failed to load dashboard data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId) return;
    setIsRefreshing(true);
    try {
      await api.triggerMonitor(userId);
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
  ) => {
    if (!userId) return;
    await api.addHotel(userId, name, location, isTarget, currency);
    await fetchData();
  };

  const handleDeleteHotel = async (hotelId: string) => {
    if (!userId || !confirm("Are you sure you want to remove this hotel monitor?")) return;
    try {
      await api.deleteHotel(hotelId);
      await fetchData();
    } catch (error) {
      console.error("Failed to delete hotel:", error);
      alert("Failed to delete hotel monitor.");
    }
  };

  const handleQuickAdd = async (name: string, location: string) => {
    if (!userId) return;
    await handleAddHotel(name, location, false, userSettings?.currency || "USD");
  };

  const handleSaveSettings = async (settings: UserSettings) => {
    if (!userId) return;
    await api.updateSettings(userId, settings);
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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--deep-ocean)] text-white gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] rounded-lg font-bold hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data && loading) return null;

  const effectiveTargetPrice = data?.target_hotel?.price_info?.current_price || 0;

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
            <p className="text-[var(--text-secondary)] mt-1 text-xs">
              Direct intelligence for revenue management
            </p>
          </div>

          {/* Market Pulse Summary */}
          {data?.competitors?.length && (
            <div className="hidden xl:flex items-center gap-4 px-4 border-l border-white/5">
              <div className="text-right">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">Market Pulse</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`text-sm font-black ${
                    (data.competitors.reduce((acc, c) => acc + (c.price_info?.change_percent || 0), 0) / (data.competitors.length || 1)) > 0 
                    ? 'text-alert-red' : 'text-optimal-green'
                  }`}>
                    {(data.competitors.reduce((acc, c) => acc + (c.price_info?.change_percent || 0), 0) / (data.competitors.length || 1)).toFixed(1)}%
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    (data.competitors.reduce((acc, c) => acc + (c.price_info?.change_percent || 0), 0) / (data.competitors.length || 1)) > 0 
                    ? 'bg-alert-red' : 'bg-optimal-green'
                  }`} />
                </div>
              </div>
            </div>
          )}


          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Alerts Badge */}
            <button className="relative p-3 glass rounded-xl hover:bg-white/10 transition-colors">
              <Bell className="w-5 h-5 text-white" />
              {(data?.unread_alerts_count || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {data?.unread_alerts_count}
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

            {/* Manual Search (Scan Now) */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`
                btn-gold flex items-center gap-2 px-6 shadow-lg shadow-[var(--soft-gold)]/20
                ${isRefreshing ? "opacity-75 cursor-wait" : "hover:scale-105"}
              `}
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="font-bold">
                {isRefreshing ? "Scanning..." : "Scan Now"}
              </span>
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
          {loading || isRefreshing ? (
            <>
              <SkeletonTile large />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </>
          ) : (
            <>
              {/* Target Hotel - Large Tile */}
              {data?.target_hotel && (
                <TargetHotelTile
                  id={data.target_hotel.id}
                  name={data.target_hotel.name}
                  location={data.target_hotel.location}
                  currentPrice={effectiveTargetPrice}
                  previousPrice={data.target_hotel.price_info?.previous_price}
                  currency={data.target_hotel.price_info?.currency || userSettings?.currency || "USD"}
                  trend={data.target_hotel.price_info?.trend || "stable"}
                  changePercent={data.target_hotel.price_info?.change_percent || 0}
                  lastUpdated={data.target_hotel.price_info ? "Updated just now" : "Pending initial scan"}
                  onDelete={handleDeleteHotel}
                />
              )}

              {/* Competitor Tiles */}
              {data?.competitors && [...data.competitors]
                .sort((a, b) => (a.price_info?.current_price || 0) - (b.price_info?.current_price || 0))
                .map((competitor, index) => {
                  const isUndercut =
                    competitor.price_info &&
                    competitor.price_info.current_price < effectiveTargetPrice;

                  return (
                    <CompetitorTile
                      key={competitor.id}
                      id={competitor.id}
                      name={competitor.name}
                      currentPrice={competitor.price_info?.current_price || 0}
                      previousPrice={competitor.price_info?.previous_price}
                      currency={competitor.price_info?.currency || "USD"}
                      trend={competitor.price_info?.trend || "stable"}
                      changePercent={competitor.price_info?.change_percent || 0}
                      isUndercut={isUndercut}
                      rank={index + 1}
                      onDelete={handleDeleteHotel}
                    />
                  );
                })}
            </>
          )}
        </BentoGrid>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-alert-red">
              {
                (data?.competitors || []).filter(
                  (c) =>
                    c.price_info && c.price_info.current_price < effectiveTargetPrice,
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)] group-hover:text-alert-red transition-colors">Yield Risk Area</p>
          </div>
          <div className="glass-card p-4 text-center group">
            <p className="text-2xl font-bold text-optimal-green">
              {
                (data?.competitors || []).filter((c) => c.price_info?.trend === "down")
                  .length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)] group-hover:text-optimal-green transition-colors">Market Opportunity</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data?.competitors && data.competitors.length > 0 ? (
                <>
                  {data.target_hotel?.price_info?.currency === "TRY" ? "₺" : "$"}
                  {Math.round(
                    (data?.competitors || []).reduce(
                      (sum, c) => sum + (c.price_info?.current_price || 0),
                      0,
                    ) / (data?.competitors?.length || 1),
                  )}
                </>
              ) : "—"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Avg Competitor</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {(data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Hotels Tracked</p>
          </div>
        </div>

        {/* Scan History Row */}
        <ScanHistory scans={data?.scan_history || []} />

        {/* Recent Searches Row */}
        <RecentSearches 
          searches={data?.recent_searches || []} 
          onAddHotel={handleQuickAdd}
        />

        {/* Footer */}
        <footer className="mt-20 py-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[var(--text-muted)] text-sm">
            © 2026 Hotel Rate Monitor. All rates fetched via SerpApi.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-[var(--text-muted)] hover:text-white transition-colors text-xs font-medium uppercase tracking-wider">Privacy</a>
            <a href="#" className="text-[var(--text-muted)] hover:text-white transition-colors text-xs font-medium uppercase tracking-wider">Terms</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
