"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useModals } from "@/hooks/useModals";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoGrid from "@/components/ui/BentoGrid";
import TargetHotelTile from "@/components/tiles/TargetHotelTile";
import CompetitorTile from "@/components/tiles/CompetitorTile";
import { RefreshCw, Plus, Zap, Cpu, Info, Smile, ArrowLeftRight, Activity, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import {
  DashboardData,
  UserSettings,
  ScanSession,
  ScanOptions,
  Hotel,
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
import { parsePrice, formatCurrency, formatDateTime } from "@/lib/utils";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { useModalContext } from "@/components/ui/ModalContext";
import { GlobalPulseFeed } from "@/components/tiles/GlobalPulseFeed";
import { DashboardHeader, MarketInsight, PerformanceMetrics } from "@/components/dashboard";

// --- Components ---


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
    handleAddHotel,
    handleDeleteHotel,
    handleSetTargetHotel,
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
    handleOpenAddHotel,
    handleReSearch,
    reSearchName,
    reSearchLocation,
    selectedSession,
    hotelToEdit,
    isEditHotelOpen,
    isSessionModalOpen,
    isDetailsModalOpen,
    selectedHotelForDetails,
  } = useModalContext();

  const handleSaveSettings = async (settings: UserSettings) => {
    await updateSettings(settings);
  };

  // Memoized derived values to prevent recalculation on every render
  const effectiveTargetPrice = useMemo(
    () => parsePrice(data?.target_hotel?.price_info?.current_price || 0),
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
    const validCompetitors = (data?.competitors || []).filter(c => parsePrice(c.price_info?.current_price || 0) > 0);
    if (!validCompetitors.length) return 0;
    
    return Math.round(
      validCompetitors.reduce(
        (sum, c) => sum + parsePrice(c.price_info?.current_price || 0),
        0,
      ) / validCompetitors.length,
    );
  }, [data?.competitors]);


  const undercuttingCount = useMemo(
    () =>
      (data?.competitors || []).filter(
        (c) => {
          const price = parsePrice(c.price_info?.current_price || 0);
          return price > 0 && price < effectiveTargetPrice;
        }
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
    ],
  );

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

      <main className="max-w-7xl mx-auto">
        <DashboardHeader 
          lastUpdate={data?.last_updated ? formatDateTime(data.last_updated) : undefined}
          onAddHotel={handleOpenAddHotel}
          loading={loading || isRefreshing}
        />

        {data?.market_insight && (
          <div className="mb-8">
            <MarketInsight 
              insight={data.market_insight} 
              loading={loading || isRefreshing} 
            />
          </div>
        )}

        <ErrorBoundary>
          <BentoGrid>
            {loading || isRefreshing ? (
              <>
                {/* 
                  Skeleton tiles for loading state.
                  Matches count of current hotels to minimize layout shift.
                */}
                {[...Array(data?.competitors?.length ? data.competitors.length + 1 : 3)].map((_, i) => (
                  <SkeletonTile key={i} large={i === 0 && !!data?.target_hotel} />
                ))}
              </>
            ) : !data?.target_hotel &&
              (!data?.competitors || data.competitors.length === 0) ? (
              <div className="col-span-full">
                <ZeroState onAddHotel={handleOpenAddHotel} />
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
                        data.target_hotel.price_info?.recorded_at
                          ? formatDateTime(data.target_hotel.price_info.recorded_at)
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
                      onEdit={(id, hotel) => handleEditHotel(hotel)}
                      offers={data.target_hotel.price_info?.offers}
                      room_types={data.target_hotel.price_info?.room_types}
                      onViewDetails={() => data.target_hotel && handleOpenDetails(data.target_hotel)}
                      isEnterprise={isEnterprise}
                      amenities={data.target_hotel.amenities}
                      images={data.target_hotel.images}
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

                {data?.target_hotel && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-6">
                    <PerformanceMetrics 
                      avgRating={data.agg_metrics?.avg_rating}
                      rateParityScore={data.agg_metrics?.rate_parity_score}
                      loading={loading || isRefreshing}
                    />
                  </div>
                )}

                {data?.competitors &&
                  [...data.competitors]
                    .sort(
                      (a, b) =>
                        parsePrice(a.price_info?.current_price || 0) -
                        parsePrice(b.price_info?.current_price || 0),
                    )
                    .map((competitor, index) => {
                      const isUndercut =
                        competitor.price_info &&
                        parsePrice(competitor.price_info.current_price) <
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
                            lastUpdated={
                              competitor.price_info?.recorded_at
                                ? formatDateTime(competitor.price_info.recorded_at)
                                : t("dashboard.pendingInitial")
                            }
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
                            onEdit={(id, hotel) => handleEditHotel(hotel)}
                            onViewDetails={() =>
                              handleOpenDetails(competitor)
                            }
                            onSetTarget={handleSetTargetHotel}
                            isEnterprise={isEnterprise}
                            amenities={competitor.amenities}
                            images={competitor.images}
                            offers={competitor.price_info?.offers}
                            room_types={competitor.price_info?.room_types}
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

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-8"
        >
          <GlobalPulseFeed />
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
            className="glass-card p-6 text-center group cursor-default rounded-[2rem] border-[var(--alert-red)]/20 bg-[var(--alert-red)]/5"
          >
            <p className="text-3xl font-black text-[var(--alert-red)] tracking-tighter mb-1">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) => {
                    const price = parsePrice(c.price_info?.current_price || 0);
                    return price > 0 && price < effectiveTargetPrice;
                  }
                ).length

              }
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-[var(--alert-red)] transition-colors">
              {t("dashboard.yieldRisk")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="glass-card p-6 text-center group cursor-default rounded-[2rem] border-[var(--optimal-green)]/20 bg-[var(--optimal-green)]/5"
          >
            <p className="text-3xl font-black text-[var(--optimal-green)] tracking-tighter mb-1">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) => c.price_info?.trend === "down",
                ).length
              }
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-[var(--optimal-green)] transition-colors">
              {t("dashboard.marketOpportunity")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="glass-card p-6 text-center group cursor-default rounded-[2rem]"
          >
            <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter mb-1">
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

                    const validCompetitors = (data?.competitors || []).filter(
                      (c: HotelWithPrice) => parsePrice(c.price_info?.current_price || 0) > 0
                    );
                    
                    if (validCompetitors.length === 0) return 0;

                    const avgPrice = Math.round(
                      validCompetitors.reduce(
                        (sum: number, c: HotelWithPrice) =>
                          sum + parsePrice(c.price_info?.current_price || 0),
                        0,
                      ) / validCompetitors.length,
                    );


                    return formatCurrency(avgPrice, activeCurrency);
                  })()}
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t("dashboard.avgCompetitor")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="glass-card p-6 text-center group cursor-default rounded-[2rem]"
          >
            <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter mb-1">
              {currentHotelCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
