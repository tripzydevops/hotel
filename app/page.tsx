"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useModals } from "@/hooks/useModals";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
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
import BottomNav from "@/components/layout/BottomNav";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import ModalLoading from "@/components/ui/ModalLoading";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";

// Lazy load heavy modals to improve initial load performance
const ScanSessionModal = lazy(
  () => import("@/components/modals/ScanSessionModal"),
);
const AlertsModal = lazy(() => import("@/components/modals/AlertsModal"));
const ScanSettingsModal = lazy(
  () => import("@/components/modals/ScanSettingsModal"),
);
const EditHotelModal = lazy(() => import("@/components/modals/EditHotelModal"));
const SubscriptionModal = lazy(
  () => import("@/components/modals/SubscriptionModal"),
);
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
    isAddHotelOpen,
    setIsAddHotelOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isAlertsOpen,
    setIsAlertsOpen,
    isProfileOpen,
    setIsProfileOpen,
    isBillingOpen,
    setIsBillingOpen,
    isEditHotelOpen,
    setIsEditHotelOpen,
    hotelToEdit,
    setHotelToEdit,
    isSessionModalOpen,
    setIsSessionModalOpen,
    selectedSession,
    isScanSettingsOpen,
    setIsScanSettingsOpen,
    scanDefaults,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    selectedHotelForDetails,
    reSearchName,
    setReSearchName,
    reSearchLocation,
    setReSearchLocation,
    handleOpenDetails,
    handleOpenSession,
    handleEditHotel,
    handleRefresh,
    handleReSearch,
  } = useModals();

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
      {/* Cinematic Background Layers */}
      <div className="radial-glow" />
      <div className="bg-grain" />

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
      <Header
        userProfile={profile}
        hotelCount={currentHotelCount}
        unreadCount={data?.unread_alerts_count}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
      />

      <Suspense fallback={<ModalLoading />}>
        <AddHotelModal
          isOpen={isAddHotelOpen}
          onClose={() => {
            setIsAddHotelOpen(false);
            setReSearchName("");
            setReSearchLocation("");
          }}
          onAdd={handleAddHotel}
          initialName={reSearchName}
          initialLocation={reSearchLocation}
          currentHotelCount={currentHotelCount}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={userSettings}
          onSave={handleSaveSettings}
        />

        <ScanSessionModal
          isOpen={isSessionModalOpen}
          onClose={() => setIsSessionModalOpen(false)}
          session={selectedSession}
        />

        <ScanSettingsModal
          isOpen={isScanSettingsOpen}
          onClose={() => setIsScanSettingsOpen(false)}
          onScan={async (options) => {
            await handleScan(options);
          }}
          onUpgrade={() => {
            setIsScanSettingsOpen(false);
            setIsBillingOpen(true);
          }}
          initialValues={scanDefaults}
          userPlan={
            profile?.role === "admin" ? "enterprise" : profile?.plan_type
          }
          dailyLimitReached={
            profile?.role === "admin"
              ? false
              : data?.recent_sessions?.some(
                  (s) =>
                    s.session_type === "manual" &&
                    s.created_at.startsWith(
                      new Date().toISOString().split("T")[0],
                    ),
                ) || false
          }
        />

        {hotelToEdit && (
          <EditHotelModal
            isOpen={isEditHotelOpen}
            onClose={() => {
              setIsEditHotelOpen(false);
              setHotelToEdit(null);
            }}
            hotel={hotelToEdit}
            onUpdate={fetchData}
          />
        )}

        <AlertsModal
          isOpen={isAlertsOpen}
          onClose={() => setIsAlertsOpen(false)}
          userId={userId || ""}
          onUpdate={fetchData}
        />

        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userId={userId || ""}
        />

        <SubscriptionModal
          isOpen={isBillingOpen}
          onClose={() => setIsBillingOpen(false)}
          currentPlan={profile?.plan_type || "trial"}
          onUpgrade={async (plan) => {
            if (!userId) return;
            setProfile({
              ...profile,
              plan_type: plan,
              subscription_status: "active",
            });
            toast.success(t("dashboard.upgradedToPlan", { plan }));
            setIsBillingOpen(false);
          }}
        />

        <HotelDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          hotel={selectedHotelForDetails}
          isEnterprise={
            profile?.plan_type === "enterprise" || profile?.plan_type === "pro"
          }
          onUpgrade={() => {
            setIsDetailsModalOpen(false);
            setIsBillingOpen(true);
          }}
        />
      </Suspense>

      <BottomNav
        onOpenAddHotel={() => setIsAddHotelOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        unreadCount={data?.unread_alerts_count}
      />

      <main className="pt-20 sm:pt-24 pb-24 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              {t("dashboard.title")}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[8px] font-black text-[var(--soft-gold)] uppercase tracking-tighter animate-pulse shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                <Cpu className="w-2.5 h-2.5" />
                {t("dashboard.agentMeshActive")}
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mt-1 text-xs">
              {t("dashboard.subtitle")}
            </p>
          </motion.div>

          {data?.competitors?.length && (
            <div className="hidden xl:flex items-center gap-4 px-4 border-l border-white/5">
              {data.next_scan_at && (
                <div className="text-right pr-4 border-r border-white/5 group relative cursor-help">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest flex items-center justify-end gap-1">
                    {t("dashboard.nextScheduledScan")}
                    <Info className="w-2.5 h-2.5 opacity-50" />
                  </p>
                  <p className="text-sm font-black text-[var(--soft-gold)]">
                    {new Date(data.next_scan_at).toLocaleTimeString(
                      locale === "tr" ? "tr-TR" : "en-US",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                  {/* Tooltip */}
                  <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-white leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                    {t("dashboard.nextScanNote") ||
                      "Manual scans reset the scheduled countdown."}
                  </div>
                </div>
              )}
              <div className="text-right">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">
                  {t("dashboard.marketPulse")}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <span
                    className={`text-sm font-black ${
                      marketPulseAvg > 0
                        ? "text-alert-red"
                        : "text-optimal-green"
                    }`}
                  >
                    {marketPulseAvg.toFixed(1)}%
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      marketPulseAvg > 0 ? "bg-alert-red" : "bg-optimal-green"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRefresh(data)}
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
                {isRefreshing ? t("common.scanning") : t("common.scanNow")}
              </span>
            </button>

            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="btn-gold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("common.addHotel")}</span>
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
            className="command-card p-4 text-center group cursor-default shadow-lg hover:shadow-[var(--soft-gold)]/5"
          >
            <p className="text-2xl font-bold text-alert-red">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) =>
                    c.price_info &&
                    c.price_info.current_price < effectiveTargetPrice,
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-secondary)] group-hover:text-alert-red transition-colors">
              {t("dashboard.yieldRisk")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="command-card p-4 text-center group cursor-default shadow-lg hover:shadow-optimal-green/5"
          >
            <p className="text-2xl font-bold text-optimal-green">
              {
                (data?.competitors || []).filter(
                  (c: HotelWithPrice) => c.price_info?.trend === "down",
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-secondary)] group-hover:text-optimal-green transition-colors">
              {t("dashboard.marketOpportunity")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="command-card p-4 text-center group cursor-default shadow-lg hover:shadow-white/5"
          >
            <p className="text-2xl font-bold text-white">
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
            <p className="text-xs text-[var(--text-secondary)]">
              {t("dashboard.avgCompetitor")}
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="command-card p-4 text-center group cursor-default shadow-lg hover:shadow-white/5"
          >
            <p className="text-2xl font-bold text-white">{currentHotelCount}</p>
            <p className="text-xs text-[var(--text-secondary)]">
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
