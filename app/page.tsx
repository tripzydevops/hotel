"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useModals } from "@/hooks/useModals";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoGrid from "@/components/ui/BentoGrid";
import TargetHotelTile from "@/components/tiles/TargetHotelTile";
import CompetitorTile from "@/components/tiles/CompetitorTile";
import { RefreshCw, Plus, Zap, Cpu, Info } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import {
  DashboardData,
  UserSettings,
  ScanSession,
  ScanOptions,
  Hotel,
  HotelWithPrice,
} from "@/types";
import AddHotelModal from "@/components/modals/AddHotelModal";
import ProfileModal from "@/components/modals/ProfileModal";
import SettingsModal from "@/components/modals/SettingsModal";
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
import { useModalContext } from "@/components/ui/ModalContext";

const HotelDetailsModal = lazy(
  () => import("@/components/modals/HotelDetailsModal"),
);

export default function Dashboard() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { userId: authUserId } = useAuth();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const impersonateId = searchParams?.get("impersonate");
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
  } = useDashboard(userId, t);

  // Trigger lazy scan check on dashboard load
  useEffect(() => {
    if (userId) {
      api.checkScheduledScan(userId).catch((err) => {
        console.error("[LazyCron] Failed to check scheduled scan:", err);
      });
    }
  }, [userId]);

  const {
    setIsAddHotelOpen,
    setIsBillingOpen,
    setHotelToEdit,
    setIsEditHotelOpen,
    setSelectedSession,
    setIsSessionModalOpen,
    setSelectedHotelForDetails,
    setIsDetailsModalOpen,
    setReSearchName,
    setReSearchLocation,
    handleOpenDetails,
    handleOpenSession,
    handleEditHotel,
    handleRefresh,
    handleReSearch,
    reSearchName,
    reSearchLocation,
    isScanSettingsOpen,
    selectedSession,
    scanDefaults,
    hotelToEdit,
    isEditHotelOpen,
    isSessionModalOpen,
    isDetailsModalOpen,
    selectedHotelForDetails,
  } = useModalContext();

  const handleSaveSettings = async (settings: UserSettings) => {
    await updateSettings(settings);
    // Refresh modals defaults if needed
    if (data) {
      handleRefresh(data);
    }
  };

  // Memoized derived values to prevent recalculation on every render
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
    () => profile?.plan_type === "enterprise" || profile?.plan_type === "pro",
    [profile?.plan_type],
  );

  // Memoized market pulse calculation (was calculated inline multiple times)
  const marketPulseAvg = useMemo(() => {
    if (!data?.competitors?.length) return 0;
    return (
      data.competitors.reduce(
        (acc, c) => acc + (c.price_info?.change_percent || 0),
        0,
      ) / data.competitors.length
    );
  }, [data?.competitors]);

  const avgCompetitorPrice = useMemo(() => {
    if (!data?.competitors?.length) return 0;
    return Math.round(
      data.competitors.reduce(
        (sum, c) => sum + (c.price_info?.current_price || 0),
        0,
      ) / data.competitors.length,
    );
  }, [data?.competitors]);

  const undercuttingCount = useMemo(
    () =>
      (data?.competitors || []).filter(
        (c) =>
          c.price_info && c.price_info.current_price < effectiveTargetPrice,
      ).length,
    [data?.competitors, effectiveTargetPrice],
  );

  const pricesDroppedCount = useMemo(
    () =>
      (data?.competitors || []).filter((c) => c.price_info?.trend === "down")
        .length,
    [data?.competitors],
  );

  const activeCurrency = useMemo(
    () =>
      data?.target_hotel?.price_info?.currency ||
      data?.competitors?.find((c) => c.price_info?.currency)?.price_info
        ?.currency ||
      userSettings?.currency ||
      "TRY",
    [
      data?.target_hotel?.price_info?.currency,
      data?.competitors,
      userSettings?.currency,
    ],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)]">
        <LoadingState rows={1} skeleton={<ModalLoading />} />
      </div>
    );
  }

  if (error) {
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

  if (!data && loading) return null;

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

      <main className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-4">
          <div className="flex items-center gap-3">
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
                group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 p-[1px] shadow-2xl shadow-amber-500/20 transition-all active:scale-95 hover:scale-105
              "
            >
              <div className="relative flex items-center gap-2 bg-[#050B18] px-5 py-2.5 rounded-[11px] transition-colors group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-yellow-500">
                <Plus className="w-4 h-4 text-amber-400 transition-colors group-hover:text-black stroke-[3px]" />
                <span className="font-bold text-amber-400 text-sm uppercase tracking-widest transition-colors group-hover:text-black">
                  {t("common.addHotel")}
                </span>
              </div>
            </button>
          </div>
        </div>

        <ErrorBoundary>
          <BentoGrid>
            {loading || isRefreshing ? (
              <>
                <SkeletonTile large />
                <SkeletonTile />
                <SkeletonTile />
                <SkeletonTile />
              </>
            ) : !data?.target_hotel &&
              (!data?.competitors || data.competitors.length === 0) ? (
              <div className="col-span-full">
                <ZeroState onAddHotel={() => setIsAddHotelOpen(true)} />
              </div>
            ) : (
              <>
                {data?.target_hotel && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
                  >
                    <TargetHotelTile
                      id={data.target_hotel.id}
                      name={data.target_hotel.name}
                      location={data.target_hotel.location}
                      currentPrice={effectiveTargetPrice}
                      previousPrice={
                        data.target_hotel.price_info?.previous_price
                      }
                      currency={
                        data.target_hotel.price_info?.currency ||
                        data.competitors?.[0]?.price_info?.currency ||
                        userSettings?.currency ||
                        "TRY"
                      }
                      trend={data.target_hotel.price_info?.trend || "stable"}
                      changePercent={
                        data.target_hotel.price_info?.change_percent || 0
                      }
                      lastUpdated={
                        data.target_hotel.price_info
                          ? t("common.justNow")
                          : t("dashboard.pendingInitial")
                      }
                      onDelete={handleDeleteHotel}
                      rating={data.target_hotel.rating}
                      stars={data.target_hotel.stars}
                      imageUrl={data.target_hotel.image_url}
                      vendor={data.target_hotel.price_info?.vendor}
                      priceHistory={data.target_hotel.price_history}
                      checkIn={data.target_hotel.price_info?.check_in}
                      adults={data.target_hotel.price_info?.adults}
                      onEdit={(id) => handleEditHotel(id, data)}
                      onViewDetails={(hotel) => handleOpenDetails(hotel, data)}
                      isEnterprise={isEnterprise}
                      amenities={data.target_hotel.amenities}
                      images={data.target_hotel.images}
                      offers={data.target_hotel.price_info?.offers}
                    />
                  </motion.div>
                )}

                {data?.competitors &&
                  [...data.competitors]
                    .sort(
                      (a, b) =>
                        (a.price_info?.current_price || 0) -
                        (b.price_info?.current_price || 0),
                    )
                    .map((competitor, index) => {
                      const isUndercut =
                        competitor.price_info &&
                        competitor.price_info.current_price <
                          effectiveTargetPrice;

                      return (
                        <motion.div
                          key={competitor.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.05 * (index + 1),
                          }}
                          className="col-span-1"
                        >
                          <CompetitorTile
                            id={competitor.id}
                            name={competitor.name}
                            currentPrice={
                              competitor.price_info?.current_price || 0
                            }
                            previousPrice={
                              competitor.price_info?.previous_price
                            }
                            currency={competitor.price_info?.currency || "TRY"}
                            trend={competitor.price_info?.trend || "stable"}
                            changePercent={
                              competitor.price_info?.change_percent || 0
                            }
                            isUndercut={isUndercut}
                            rank={index + 1}
                            onDelete={handleDeleteHotel}
                            rating={competitor.rating}
                            stars={competitor.stars}
                            imageUrl={competitor.image_url}
                            vendor={competitor.price_info?.vendor}
                            priceHistory={competitor.price_history}
                            checkIn={competitor.price_info?.check_in}
                            adults={competitor.price_info?.adults}
                            onEdit={(id) => handleEditHotel(id, data)}
                            onViewDetails={(hotel) =>
                              handleOpenDetails(hotel, data)
                            }
                            isEnterprise={isEnterprise}
                            amenities={competitor.amenities}
                            images={competitor.images}
                            offers={competitor.price_info?.offers}
                          />
                        </motion.div>
                      );
                    })}
              </>
            )}
          </BentoGrid>
        </ErrorBoundary>

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
      </main>
    </div>
  );
}
