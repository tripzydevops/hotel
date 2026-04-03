"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useModals } from "@/hooks/useModals";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoGrid from "@/components/ui/BentoGrid";
import TargetHotelTile from "@/components/tiles/TargetHotelTile";
import CompetitorTile from "@/components/tiles/CompetitorTile";
import { RefreshCw, Plus, Zap, Cpu, Info, Clock, Users } from "lucide-react";
import { api } from "@/lib/api";
import {
  DashboardData,
  UserSettings,
  ScanSession,
  ScanOptions,
  Hotel,
  HotelWithPrice,
} from "@/types";
import SkeletonTile from "@/components/tiles/SkeletonTile";
import ScanHistory from "@/components/features/dashboard/ScanHistory";
import SearchHistory from "@/components/features/dashboard/SearchHistory";
import RapidPulseHistory from "@/components/features/dashboard/RapidPulseHistory";
import GlobalPulseFeed from "@/components/features/dashboard/GlobalPulseFeed";
import { PaywallOverlay } from "@/components/ui/PaywallOverlay";
import { useToast } from "@/components/ui/ToastContext";
import ZeroState from "@/components/ui/ZeroState";
import { useI18n } from "@/lib/i18n";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import ModalLoading from "@/components/ui/ModalLoading";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { useModalContext } from "@/components/ui/ModalContext";

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

  // Removed: Lazy scan check on dashboard load. Scans are now handled by GitHub Action schedule or Manual user trigger.

  const {
    isAddHotelOpen,
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
    () =>
      profile?.role === "admin" ||
      profile?.plan_type?.toLowerCase() === "enterprise" ||
      profile?.plan_type?.toLowerCase() === "pro" ||
      profile?.plan_type?.toLowerCase() === "trial",
    [profile?.plan_type, profile?.role],
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] transition-colors duration-500">
        <LoadingState rows={1} skeleton={<ModalLoading />} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] transition-colors duration-500">
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-[var(--alert-red)]/90 text-[var(--text-primary)] px-6 py-2 rounded-full font-bold shadow-2xl backdrop-blur-md border border-[var(--glass-border)] animate-pulse">
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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Intelligence Header Area */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 relative">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-gradient-to-b from-[var(--soft-gold)] to-transparent rounded-full shadow-[0_0_15px_rgba(246,195,68,0.3)]" />
              <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic">
                Sentinel Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">
              <div className="flex items-center gap-2 px-2 py-0.5 bg-[var(--deep-ocean)] rounded border border-[var(--glass-border)]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_var(--optimal-green)] animate-pulse" />
                <span>System Online</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-50">Local Time:</span>
                <span className="text-[var(--text-primary)]">
                  {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {!isRefreshing && (
              <div className="flex flex-col items-end px-4 py-2 bg-[var(--deep-ocean)]/40 rounded-2xl border border-[var(--glass-border)] group">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] group-hover:text-amber-400/60 transition-colors">
                  Next Scheduled Scan
                </span>
                <div className="flex items-center gap-2">
                   <Clock className="w-3 h-3 text-amber-500/50" />
                   <span className="text-sm font-black text-amber-400 tabular-nums shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                    {data?.next_scan_at ? (
                      new Date(data.next_scan_at).toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    ) : (
                      "04:00"
                    )}
                  </span>
                </div>
              </div>
            )}
            
            <div className="h-12 w-px bg-[var(--glass-border)] mx-2 hidden md:block" />

            <button
              onClick={() => handleRefresh(data)}
              disabled={isRefreshing}
              className={`
                group relative p-[1px] rounded-2xl transition-all active:scale-95
                ${isRefreshing ? "opacity-75 cursor-wait" : "hover:scale-105"}
              `}
            >
              <div className="bg-[var(--glass-bg-accent)] backdrop-blur-xl hover:bg-[var(--bg-accent)] px-6 py-3 rounded-[15px] flex items-center gap-3 transition-all border border-[var(--glass-border)] group-hover:border-[var(--glass-border-hover)]">
                <RefreshCw
                  className={`w-4 h-4 text-indigo-400 ${isRefreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`}
                />
                <span className="font-black text-[var(--text-primary)] text-xs uppercase tracking-[0.25em]">
                  {isRefreshing ? "Synchronizing" : "Manual Sync"}
                </span>
              </div>
            </button>

            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="
                group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--soft-gold)] to-[#D4AF37] p-[1px] shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all active:scale-95 hover:scale-105 hover:shadow-[var(--soft-gold)]/40
              "
            >
              <div className="relative flex items-center gap-2.5 bg-[#D4AF37] px-6 py-3 rounded-[15px] transition-colors">
                <Plus className="w-4 h-4 text-[var(--deep-ocean)] stroke-[4px]" />
                <span className="font-black text-[var(--deep-ocean)] text-xs uppercase tracking-[0.2em]">
                  Track Asset
                </span>
              </div>
            </button>
          </div>
        </div>

        <ErrorBoundary>
          <BentoGrid>
            {loading || isRefreshing ? (
              <>
                {/* 
                  EXPLANATION: Scan UX Synchronization
                  Instead of a hardcoded 4 skeletons, we match the skeleton count 
                  to the actual number of hotels to prevent "multiplicity" flickering 
                  and visual jitter during the scan refresh.
                */}
                {[...Array(data?.competitors?.length ? data.competitors.length + 1 : 3)].map((_, i) => (
                  <SkeletonTile key={i} large={i === 0 && !!data?.target_hotel} />
                ))}
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
                      checkOut={data.target_hotel.price_info?.check_out}
                      adults={data.target_hotel.price_info?.adults}
                      onEdit={(id) => handleEditHotel(id, data)}
                      onViewDetails={(hotel) => handleOpenDetails(hotel, data)}
                      isEnterprise={isEnterprise}
                      amenities={data.target_hotel.amenities}
                      images={data.target_hotel.images}
                      offers={data.target_hotel.price_info?.offers}
                      isEstimated={data.target_hotel.price_info?.is_estimated}
                      phone={data.target_hotel.phone}
                      email={data.target_hotel.email}
                      website={data.target_hotel.website}
                      address={data.target_hotel.address}
                      description={data.target_hotel.description}
                      cid={data.target_hotel.cid}
                      placeId={data.target_hotel.place_id}
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
                            checkOut={competitor.price_info?.check_out}
                            adults={competitor.price_info?.adults}
                            isEstimated={competitor.price_info?.is_estimated}
                            onEdit={(id) => handleEditHotel(id, data)}
                            onViewDetails={(hotel) =>
                              handleOpenDetails(hotel, data)
                            }
                            isEnterprise={isEnterprise}
                            amenities={competitor.amenities}
                            images={competitor.images}
                            offers={competitor.price_info?.offers}
                            phone={competitor.phone}
                            email={competitor.email}
                            website={competitor.website}
                            address={competitor.address}
                            description={competitor.description}
                            cid={competitor.cid}
                            placeId={competitor.place_id}
                          />
                        </motion.div>
                      );
                    })}
              </>
            )}
          </BentoGrid>
        </ErrorBoundary>

        {/* Secondary Intel Layer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12 items-start">
          {/* Global Pulse (Intelligence Feed) - 4 cols */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-4"
          >
            <GlobalPulseFeed />
          </motion.div>

          {/* Quick Metrics & System Information - 8 cols */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              {/* Metric 1: Yield Risk */}
              <div className="glass-modal p-6 group cursor-default rounded-[2rem] border-[var(--alert-red)]/10 bg-[var(--alert-red)]/[0.02] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Info className="w-4 h-4 text-[var(--alert-red)]" />
                </div>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-2 inline-flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)]" />
                        Capture Risk
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-[var(--alert-red)] tracking-tighter leading-none group-hover:scale-110 transition-transform origin-left">
                            {undercuttingCount}
                        </span>
                        <span className="text-[10px] font-black text-[var(--alert-red)]/60 uppercase">Nodes</span>
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-muted)] mt-2 leading-tight">Assets currently undercutting target yield.</p>
                </div>
              </div>

              {/* Metric 2: Market Opp */}
              <div className="glass-modal p-6 group cursor-default rounded-[2rem] border-[var(--optimal-green)]/10 bg-[var(--optimal-green)]/[0.02] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Zap className="w-4 h-4 text-[var(--optimal-green)]" />
                </div>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-2 inline-flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)]" />
                        Market Drop
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-[var(--optimal-green)] tracking-tighter leading-none group-hover:scale-110 transition-transform origin-left">
                            {pricesDroppedCount}
                        </span>
                        <span className="text-[10px] font-black text-[var(--optimal-green)]/60 uppercase">Shifts</span>
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-muted)] mt-2 leading-tight">Downward price trends detected in perimeter.</p>
                </div>
              </div>

              {/* Metric 3: Avg Competitor */}
              <div className="glass-modal p-6 group cursor-default rounded-[2rem] border-[var(--glass-border)] bg-[var(--deep-ocean-lighter)]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-2 inline-flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        Avg Parity
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none group-hover:text-indigo-300 transition-colors">
                            {data?.competitors && data.competitors.length > 0 ? (
                                new Intl.NumberFormat(activeCurrency === "TRY" ? "tr-TR" : "en-US", {
                                    style: "currency",
                                    currency: activeCurrency,
                                    minimumFractionDigits: 0,
                                }).format(avgCompetitorPrice)
                            ) : "—"}
                        </span>
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-muted)] mt-3 leading-tight">Mean intelligence valuation across tracked set.</p>
                </div>
              </div>

              {/* Metric 4: Asset Count */}
              <div className="glass-modal p-6 group cursor-default rounded-[2rem] border-[var(--glass-border)] bg-[var(--deep-ocean-lighter)]/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-2 inline-flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Active Relay
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-[var(--text-primary)] tracking-tighter leading-none group-hover:scale-110 transition-transform origin-left">
                            {currentHotelCount}
                        </span>
                        <span className="text-[10px] font-black text-cyan-400/60 uppercase ml-1">Assets</span>
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-muted)] mt-2 leading-tight">Total unique signatures under monitoring.</p>
                </div>
              </div>
            </motion.div>

            {/* Scan History (Condensed) */}
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6, delay: 0.6 }}
            >
                <ScanHistory
                    sessions={data?.recent_sessions || []}
                    onOpenSession={handleOpenSession}
                    title="Intelligence Flow"
                />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                  <SearchHistory
                    searches={data?.recent_searches || []}
                    onReSearch={handleReSearch}
                    title="Signal History"
                  />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                  <RapidPulseHistory
                    sessions={data?.recent_sessions?.slice(0, 4) || []}
                    onOpenSession={handleOpenSession}
                    title="Rapid Pulse"
                  />
              </motion.div>
            </div>
          </div>
        </div>

        <footer className="mt-20 py-8 border-t border-[var(--glass-border)] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[var(--text-muted)] text-sm">
            {t("common.footerCopyright")}
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs font-medium uppercase tracking-wider"
            >
              {t("common.privacy")}
            </a>
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs font-medium uppercase tracking-wider"
            >
              {t("common.terms")}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
