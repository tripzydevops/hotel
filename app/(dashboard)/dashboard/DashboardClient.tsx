"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoGrid from "@/components/ui/BentoGrid";
import TargetHotelTile from "@/components/tiles/TargetHotelTile";
import CompetitorTile from "@/components/tiles/CompetitorTile";
import { RefreshCw, Plus, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  DashboardData,
  UserSettings,
  HotelWithPrice,
} from "@/types";
import SearchHistory from "@/components/features/dashboard/SearchHistory";
import SkeletonTile from "@/components/tiles/SkeletonTile";
import ScanHistory from "@/components/features/dashboard/ScanHistory";
import RapidPulseHistory from "@/components/features/dashboard/RapidPulseHistory";
import { PaywallOverlay } from "@/components/ui/PaywallOverlay";
import { useToast } from "@/components/ui/ToastContext";
import ZeroState from "@/components/ui/ZeroState";
import { useI18n } from "@/lib/i18n";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import ModalLoading from "@/components/ui/ModalLoading";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PortfolioHealthTile from "@/components/tiles/PortfolioHealthTile";
import { useModalContext } from "@/components/ui/ModalContext";
import { GlobalPulseFeed } from "@/components/tiles/GlobalPulseFeed";

interface DashboardClientProps {
  userId: string | null;
  initialData: DashboardData | null;
  impersonateId?: string | null;
}

export default function DashboardClient({ userId: authUserId, initialData, impersonateId }: DashboardClientProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const userId = impersonateId || authUserId;

  const {
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
    setProfile,
  } = useDashboard(userId, t, initialData);

  useEffect(() => {
    if (data) {
      console.log("[DashboardDebug] Data loaded encountered:", {
        target: data.target_hotel?.name,
        competitors: data.competitors?.length,
        hasPulse: !!data.global_pulse
      });
    }
  }, [data]);

  // Trigger lazy scan check on dashboard load (Delayed to prioritize render)
  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => {
        api.checkScheduledScan().catch((err) => {
          console.error("[LazyCron] Failed to check scheduled scan:", err);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  const {
    setIsAddHotelOpen,
    handleOpenDetails,
    handleOpenSession,
    handleEditHotel,
    handleRefresh,
    handleReSearch,
    reSearchName,
    reSearchLocation,
    setIsAddHotelOpen: setAddHotelOpen, // alias
  } = useModalContext();

  // Memoized derived values
  const effectiveTargetPrice = useMemo(
    () => data?.target_hotel?.price_info?.current_price || 0,
    [data?.target_hotel?.price_info?.current_price],
  );

  const isLocked = useMemo(
    () =>
      profile?.subscription_status === "past_due" ||
      profile?.subscription_status === "canceled" ||
      profile?.subscription_status === "unpaid",
    [profile?.subscription_status],
  );

  const currentHotelCount = useMemo(
    () => (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0),
    [data?.competitors?.length, data?.target_hotel],
  );

  const isEnterprise = useMemo(
    () =>
      profile?.role === "admin" ||
      profile?.plan_type?.toLowerCase() === "enterprise" ||
      profile?.plan_type?.toLowerCase() === "pro" ||
      profile?.plan_type?.toLowerCase() === "trial",
    [profile?.plan_type, profile?.role],
  );

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)]">
        <LoadingState rows={1} skeleton={<ModalLoading />} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)]">
        <ErrorState
          title={t("common.errorTitle") || "Unable to load dashboard"}
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {impersonateId && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 text-white px-6 py-2 rounded-full font-bold shadow-2xl backdrop-blur-md border border-white/20 animate-pulse">
          IMPERSONATING USER: {impersonateId.split("-")[0]}...
        </div>
      )}
      {isLocked && (
        <PaywallOverlay
          reason={
            profile?.subscription_status === "canceled"
              ? "Subscription Canceled"
              : "Trial Expired"
          }
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-4">
          <div className="flex items-center gap-3">
            {data?.next_scan_at && !isRefreshing && (
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {t("dashboard.nextScheduledScan")}
                </span>
                <span className="text-xs font-black text-[#F6C344] tabular-nums">
                  {new Date(data.next_scan_at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            <button
              onClick={() => handleRefresh(data)}
              disabled={isRefreshing}
              className={`
                metallic-gold p-[1px] rounded-xl shadow-2xl shadow-yellow-500/10 transition-all active:scale-95
                ${isRefreshing ? "opacity-75 cursor-wait" : "hover:scale-105"}
              `}
            >
              <div className="bg-[#050B18] hover:bg-[#0A1629] px-6 py-2.5 rounded-[11px] flex items-center gap-3 transition-colors">
                <RefreshCw
                  className={`w-4 h-4 text-[#F6C344] ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span className="font-bold text-white text-sm uppercase tracking-widest">
                  {isRefreshing ? t("common.scanning") : t("common.scanNow")}
                </span>
              </div>
            </button>

            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="
                group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 p-[1px] shadow-2xl shadow-amber-500/20 transition-all active:scale-95 hover:scale-105 hover:shadow-amber-500/40
              "
            >
              <div className="relative flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 rounded-[11px] transition-colors">
                <Plus className="w-4 h-4 text-black stroke-[3px]" />
                <span className="font-bold text-black text-sm uppercase tracking-widest">
                  {t("common.addHotel")}
                </span>
              </div>
            </button>
          </div>
        </div>

        <ErrorBoundary>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 items-stretch">
        {/* HERO AREA: Target Asset & Health Index */}
        {!data && loading ? (
          <div className="lg:col-span-12">
            <BentoGrid className="lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonTile key={i} />
              ))}
            </BentoGrid>
          </div>
        ) : (
          <>
            <div className="lg:col-span-8 h-full">
              <AnimatePresence mode="popLayout">
                {data?.target_hotel ? (
                  <motion.div
                    key={data.target_hotel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full"
                  >
                    <TargetHotelTile
                      id={data.target_hotel.id}
                      name={data.target_hotel.name}
                      location={data.target_hotel.location}
                      currentPrice={effectiveTargetPrice}
                      previousPrice={data.target_hotel.price_info?.previous_price}
                      currency={data.target_hotel.price_info?.currency || "TRY"}
                      trend={data.target_hotel.price_info?.trend || "stable"}
                      changePercent={data.target_hotel.price_info?.change_percent || 0}
                      lastUpdated={data.target_hotel.price_info ? t("common.justNow") : t("dashboard.pendingInitial")}
                      onDelete={handleDeleteHotel}
                      rating={data.target_hotel.rating}
                      stars={data.target_hotel.stars}
                      imageUrl={data.target_hotel.image_url}
                      vendor={data.target_hotel.price_info?.vendor}
                      priceHistory={data.target_hotel.price_history}
                      onEdit={(id) => handleEditHotel(id, data)}
                      onViewDetails={(hotel) => handleOpenDetails(hotel, data)}
                      isEnterprise={isEnterprise}
                      images={data.target_hotel.images}
                      isEstimated={data.target_hotel.price_info?.is_estimated}
                    />
                  </motion.div>
                ) : (
                  <div className="card-blur p-12 h-full rounded-[2rem] border border-white/5 flex flex-col items-center justify-center text-center">
                    <Building2 className="w-16 h-16 text-slate-700 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">{t("dashboard.noTargetTitle") || "Primary Asset Missing"}</h3>
                    <p className="text-slate-400 max-w-md mb-8">{t("dashboard.noTargetDesc") || "Set your property as the 'Target' to enable advanced rate intelligence and portfolio health indexing."}</p>
                    <button 
                      onClick={() => setIsAddHotelOpen(true)}
                      className="btn-optimal px-8 py-4 rounded-2xl flex items-center gap-2 group"
                    >
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                      {t("dashboard.addMyHotel") || "Benchmark My Hotel"}
                    </button>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-4 h-full">
              {data?.target_hotel && data.competitors && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full"
                >
                  <PortfolioHealthTile
                    targetPrice={effectiveTargetPrice}
                    competitors={data.competitors}
                  />
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>

      {/* COMPETITOR COCKPIT */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">
              {t("dashboard.competitorCockpit") || "Competitor Cockpit"}
            </h3>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 uppercase">
              {data?.competitors?.length || 0} {t("common.monitored") || "Monitored"}
            </span>
          </div>
        </div>

        <BentoGrid className="lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {data?.competitors &&
              [...data.competitors]
                .sort((a, b) => (a.price_info?.current_price || 0) - (b.price_info?.current_price || 0))
                .map((competitor, index) => (
                  <motion.div
                    key={competitor.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CompetitorTile
                      {...competitor}
                      currentPrice={competitor.price_info?.current_price || 0}
                      previousPrice={competitor.price_info?.previous_price}
                      currency={competitor.price_info?.currency || "TRY"}
                      trend={competitor.price_info?.trend || "stable"}
                      changePercent={competitor.price_info?.change_percent || 0}
                      isUndercut={competitor.price_info && competitor.price_info.current_price < effectiveTargetPrice}
                      rank={index + 1}
                      onDelete={handleDeleteHotel}
                      onEdit={(id) => handleEditHotel(id, data)}
                      onViewDetails={(hotel) => handleOpenDetails(hotel, data)}
                      isEnterprise={isEnterprise}
                    />
                  </motion.div>
                ))}
            
            {/* Add Competitor Slot */}
            <motion.button
              onClick={() => setIsAddHotelOpen(true)}
              whileHover={{ scale: 1.02 }}
              className="card-blur rounded-[2rem] border border-dashed border-white/10 p-8 flex flex-col items-center justify-center gap-3 hover:border-[#F6C344]/30 transition-all min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#F6C344]/10 transition-colors">
                <Plus className="w-6 h-6 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white tracking-tight">{t("dashboard.addCompetitor") || "Track Rival"}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Add to cockpit</p>
              </div>
            </motion.button>
          </AnimatePresence>
        </BentoGrid>
      </div>
        </ErrorBoundary>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-8"
        >
          <GlobalPulseFeed 
            initialWins={data?.global_pulse} 
            initialStats={data?.pulse_stats} 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="card-blur p-6 text-center group cursor-default rounded-3xl border border-white/5"
          >
            <p className="text-3xl font-black text-rose-500 tracking-tighter mb-1">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) =>
                    c.price_info &&
                    c.price_info.current_price < effectiveTargetPrice,
                ).length
              }
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover:text-rose-400 transition-colors">
              {t("dashboard.yieldRisk")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="card-blur p-6 text-center group cursor-default rounded-3xl border border-white/5"
          >
            <p className="text-3xl font-black text-emerald-400 tracking-tighter mb-1">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) => c.price_info?.trend === "down",
                ).length
              }
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover:text-emerald-400 transition-colors">
              {t("dashboard.marketOpportunity")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="card-blur p-6 text-center group cursor-default rounded-3xl border border-white/5"
          >
            <p className="text-3xl font-black text-white tracking-tighter mb-1">
              {data?.competitors && data.competitors.length > 0 ? (
                <>
                  {(() => {
                    const activeCurrency =
                      data.target_hotel?.price_info?.currency ||
                      data.competitors.find(
                        (c: HotelWithPrice) => c.price_info?.currency,
                      )?.price_info?.currency ||
                      userSettings?.currency ||
                      "TRY";

                    const avgPrice = Math.round(
                      (data?.competitors || []).reduce(
                        (sum: number, c: HotelWithPrice) =>
                          sum + (c.price_info?.current_price || 0),
                        0,
                      ) / (data?.competitors?.length || 1),
                    );

                    return new Intl.NumberFormat(
                      activeCurrency === "TRY" ? "tr-TR" : "en-US",
                      {
                        style: "currency",
                        currency: activeCurrency,
                        minimumFractionDigits: 0,
                      },
                    ).format(avgPrice);
                  })()}
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t("dashboard.avgCompetitor")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="card-blur p-6 text-center group cursor-default rounded-3xl border border-white/5"
          >
            <p className="text-3xl font-black text-white tracking-tighter mb-1">
              {currentHotelCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t("dashboard.hotelsTracked")}
            </p>
          </motion.div>
        </motion.div>

        <ScanHistory
          sessions={data?.recent_sessions || []}
          onOpenSession={handleOpenSession}
          title={t("dashboard.scanHistoryTitle")}
        />

        <SearchHistory
          searches={data?.recent_searches || []}
          onReSearch={handleReSearch}
          title={t("dashboard.searchHistoryTitle")}
        />

        <RapidPulseHistory
          sessions={data?.recent_sessions?.slice(0, 4) || []}
          onOpenSession={handleOpenSession}
          title={t("dashboard.rapidPulseTitle")}
        />

        <footer className="mt-20 py-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[var(--text-muted)] text-sm">
            {t("common.footerCopyright")}
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-white transition-colors text-xs font-medium uppercase tracking-wider"
            >
              {t("common.privacy")}
            </a>
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-white transition-colors text-xs font-medium uppercase tracking-wider"
            >
              {t("common.terms")}
            </a>
          </div>
        </footer>

        {/* DEBUG OVERLAY */}
        <div className="mt-8 p-6 bg-black/80 rounded-[2rem] border border-white/10 text-[10px] font-mono text-emerald-400 space-y-2 backdrop-blur-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
            <span className="font-bold uppercase tracking-widest text-[#F6C344]">System Debug Panel</span>
            <button onClick={() => window.location.reload()} className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-white transition-colors">Force Refresh</button>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <p><span className="text-slate-500">USER_ID:</span> {userId || "NOT_LOGGED_IN"}</p>
            <p><span className="text-slate-500">PROFILE:</span> {profile ? `${profile.display_name} (${profile.role})` : "NULL"}</p>
            <p><span className="text-slate-500">TARGET:</span> {data?.target_hotel ? `${data.target_hotel.name} [ID: ${data.target_hotel.id.slice(0,8)}]` : "MISSING"}</p>
            <p><span className="text-slate-500">COMPS:</span> {data?.competitors?.length || 0}</p>
            <p><span className="text-slate-500">PULSE:</span> {data?.global_pulse?.length || 0} wins</p>
            <p><span className="text-slate-500">LOADING:</span> {loading ? "TRUE" : "FALSE"}</p>
            <p><span className="text-slate-500">ERRORS:</span> <span className={error ? "text-rose-500" : "text-emerald-500"}>{error || "NONE"}</span></p>
            <p><span className="text-slate-500">INITIAL_DATA:</span> {initialData ? "PRESENT" : "MISSING"}</p>
            {data?.debug_info && (
              <>
                <p><span className="text-slate-500">RPC_STEP:</span> {data.debug_info.step}</p>
                <p><span className="text-slate-500">RPC_KEYS:</span> {data.debug_info.rpc_keys?.join(", ")}</p>
                <p><span className="text-slate-500">HOTELS_COUNT:</span> {data.debug_info.all_hotels_count}</p>
              </>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 opacity-50">
            <p className="text-[8px uppercase tracking-widest">Agent Status: Awaiting Verification...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
