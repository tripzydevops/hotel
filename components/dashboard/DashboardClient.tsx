"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BentoGrid from "@/components/BentoGrid";
import TargetHotelTile from "@/components/TargetHotelTile";
import CompetitorTile from "@/components/CompetitorTile";
import AddHotelModal from "@/components/AddHotelModal";
import SettingsModal from "@/components/SettingsModal";
import ProfileModal from "@/components/ProfileModal";
import { RefreshCw, Plus, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import {
  DashboardData,
  UserSettings,
  ScanSession,
  ScanOptions,
  Hotel,
} from "@/types";
import SearchHistory from "@/components/SearchHistory";
import SkeletonTile from "@/components/SkeletonTile";
import ScanHistory from "@/components/ScanHistory";
import RapidPulseHistory from "@/components/RapidPulseHistory";
import ScanSessionModal from "@/components/ScanSessionModal";
import AlertsModal from "@/components/AlertsModal";
import ScanSettingsModal from "@/components/ScanSettingsModal";
import EditHotelModal from "@/components/EditHotelModal";
import SubscriptionModal from "@/components/SubscriptionModal";
import { PaywallOverlay } from "@/components/PaywallOverlay";
import HotelDetailsModal from "@/components/HotelDetailsModal";
import { useToast } from "@/components/ui/ToastContext";
import ZeroState from "@/components/ZeroState";
import { useI18n } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import ReasoningShard from "@/components/ReasoningShard";

interface DashboardClientProps {
  userId: string;
  initialData: DashboardData | null;
  initialSettings: UserSettings | undefined;
  initialProfile: any;
}

export default function DashboardClient({
  userId,
  initialData,
  initialSettings,
  initialProfile,
}: DashboardClientProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(initialData);
  // We are loaded by default because we got server data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddHotelOpen, setIsAddHotelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  const [userSettings, setUserSettings] = useState<UserSettings | undefined>(
    initialSettings,
  );
  const [profile, setProfile] = useState<any>(initialProfile);

  const [isEditHotelOpen, setIsEditHotelOpen] = useState(false);
  const [hotelToEdit, setHotelToEdit] = useState<Hotel | null>(null);

  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(
    null,
  );
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isScanSettingsOpen, setIsScanSettingsOpen] = useState(false);

  const [selectedHotelForDetails, setSelectedHotelForDetails] =
    useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Re-fetch logic for client-side updates (e.g. after adding a hotel)
  const fetchData = async () => {
    if (!userId) return;
    try {
      setLoading(true); // Optional: show loading overlay or just partial spinner
      setError(null);
      const dashboardData = await api.getDashboard(userId);
      setData(dashboardData);

      const settings = await api.getSettings(userId);
      setUserSettings(settings);

      const userProfile = await api.getProfile(userId);
      setProfile(userProfile);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setError(t("common.loadingError") || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = (hotel: any) => {
    const fullHotel =
      data?.competitors.find((h) => h.id === hotel.id) ||
      (data?.target_hotel?.id === hotel.id ? data?.target_hotel : null);
    if (fullHotel) {
      setSelectedHotelForDetails(fullHotel);
      setIsDetailsModalOpen(true);
    }
  };
  const [reSearchName, setReSearchName] = useState("");
  const [reSearchLocation, setReSearchLocation] = useState("");

  const handleOpenSession = (session: ScanSession) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const handleEditHotel = (id: string, hotel: any) => {
    const fullHotel =
      data?.competitors.find((h) => h.id === id) ||
      (data?.target_hotel?.id === id ? data.target_hotel : null);
    if (fullHotel) {
      setHotelToEdit(fullHotel);
      setIsEditHotelOpen(true);
    }
  };

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

  const [scanDefaults, setScanDefaults] = useState<
    { checkIn?: string; checkOut?: string; adults?: number } | undefined
  >(undefined);

  const handleRefresh = () => {
    if (data?.target_hotel?.price_info) {
      setScanDefaults({
        checkIn: data.target_hotel.price_info.check_in,
        checkOut: data.target_hotel.price_info.check_out,
        adults: data.target_hotel.price_info.adults,
      });
    }
    setIsScanSettingsOpen(true);
  };

  const handleAddHotel = async (
    name: string,
    location: string,
    isTarget: boolean,
    currency: string,
    serpApiId?: string,
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

  const handleSaveSettings = async (settings: UserSettings) => {
    if (!userId) return;
    await api.updateSettings(userId, settings);
    setUserSettings(settings);
    // Maybe refresh data if currency changed
    fetchData(); // Simplest way to ensure currency update
  };

  const handleReSearch = (name: string, location?: string) => {
    setReSearchName(name);
    setReSearchLocation(location || "");
    setIsAddHotelOpen(true);
  };

  const effectiveTargetPrice =
    data?.target_hotel?.price_info?.current_price || 0;

  const isLocked =
    profile?.subscription_status === "past_due" ||
    profile?.subscription_status === "canceled" ||
    profile?.subscription_status === "unpaid";

  const currentHotelCount =
    (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0);

  const isEnterprise =
    profile?.plan_type === "enterprise" || profile?.plan_type === "pro";

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--deep-ocean)] text-white gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] rounded-lg font-bold hover:opacity-90 transition-opacity"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  // Fallback for empty state or loading if we ever need it
  // But usually we have initialData
  if (!data && loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--soft-gold)]"></div>
      </div>
    );

  return (
    <div className="min-h-screen pb-12 relative animate-fade-in">
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
        onScan={handleScan}
        initialValues={scanDefaults}
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
          toast.success(`Upgraded to ${plan} plan successfully!`);
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

      <BottomNav
        onOpenAddHotel={() => setIsAddHotelOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        unreadCount={data?.unread_alerts_count}
      />

      <main className="pt-20 sm:pt-24 pb-24 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              {t("dashboard.title")}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[8px] font-black text-[var(--soft-gold)] uppercase tracking-tighter animate-pulse shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                <Cpu className="w-2.5 h-2.5" />
                Agent-Mesh Active
              </span>
            </h1>
            <p className="text-[var(--text-secondary)] mt-1 text-xs">
              {t("dashboard.subtitle")}
            </p>
          </div>

          {data?.competitors?.length && (
            <div className="hidden xl:flex items-center gap-4 px-4 border-l border-white/5">
              <div className="text-right">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">
                  {t("dashboard.marketPulse")}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <span
                    className={`text-sm font-black ${
                      data.competitors.reduce(
                        (acc, c) => acc + (c.price_info?.change_percent || 0),
                        0,
                      ) /
                        (data.competitors.length || 1) >
                      0
                        ? "text-alert-red"
                        : "text-optimal-green"
                    }`}
                  >
                    {(
                      data.competitors.reduce(
                        (acc, c) => acc + (c.price_info?.change_percent || 0),
                        0,
                      ) / (data.competitors.length || 1)
                    ).toFixed(1)}
                    %
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      data.competitors.reduce(
                        (acc, c) => acc + (c.price_info?.change_percent || 0),
                        0,
                      ) /
                        (data.competitors.length || 1) >
                      0
                        ? "bg-alert-red"
                        : "bg-optimal-green"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
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

        {/* 2026 Agentic Insight Panel */}
        {data?.competitors?.length && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <ReasoningShard
              title={t("dashboard.marketPulse") || "Market Pulse"}
              insight="Competitor 'Grand Marina' dropped rates by 12% for next weekend. This correlates with a local festival cancellation."
              type="warning"
              className="md:col-span-2"
            />
            <div className="glass-panel-premium p-5 rounded-2xl flex flex-col justify-center items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                System Status
              </span>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-optimal-green animate-pulse" />
                <span className="text-lg font-bold text-white">
                  All Agents Active
                </span>
              </div>
              <span className="text-xs text-[var(--soft-gold)]">
                Next Scan: 14 mins
              </span>
            </div>
          </div>
        )}

        <BentoGrid>
          {loading && !data ? (
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
                <TargetHotelTile
                  id={data.target_hotel.id}
                  name={data.target_hotel.name}
                  location={data.target_hotel.location}
                  currentPrice={effectiveTargetPrice}
                  previousPrice={data.target_hotel.price_info?.previous_price}
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
                  onEdit={handleEditHotel}
                  onViewDetails={handleOpenDetails}
                  isEnterprise={isEnterprise}
                  amenities={data.target_hotel.amenities}
                  images={data.target_hotel.images}
                />
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
                      <CompetitorTile
                        key={competitor.id}
                        id={competitor.id}
                        name={competitor.name}
                        currentPrice={competitor.price_info?.current_price || 0}
                        previousPrice={competitor.price_info?.previous_price}
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
                        onEdit={handleEditHotel}
                        onViewDetails={handleOpenDetails}
                        isEnterprise={isEnterprise}
                        amenities={competitor.amenities}
                        images={competitor.images}
                      />
                    );
                  })}
            </>
          )}
        </BentoGrid>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-alert-red">
              {
                (data?.competitors || []).filter(
                  (c) =>
                    c.price_info &&
                    c.price_info.current_price < effectiveTargetPrice,
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)] group-hover:text-alert-red transition-colors">
              {t("dashboard.yieldRisk")}
            </p>
          </div>
          <div className="glass-card p-4 text-center group">
            <p className="text-2xl font-bold text-optimal-green">
              {
                (data?.competitors || []).filter(
                  (c) => c.price_info?.trend === "down",
                ).length
              }
            </p>
            <p className="text-xs text-[var(--text-muted)] group-hover:text-optimal-green transition-colors">
              {t("dashboard.marketOpportunity")}
            </p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {data?.competitors && data.competitors.length > 0 ? (
                <>
                  {(() => {
                    const activeCurrency =
                      data.target_hotel?.price_info?.currency ||
                      data.competitors.find((c) => c.price_info?.currency)
                        ?.price_info?.currency ||
                      userSettings?.currency ||
                      "TRY";

                    const avgPrice = Math.round(
                      (data?.competitors || []).reduce(
                        (sum, c) => sum + (c.price_info?.current_price || 0),
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
            <p className="text-xs text-[var(--text-muted)]">
              {t("dashboard.avgCompetitor")}
            </p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{currentHotelCount}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {t("dashboard.hotelsTracked")}
            </p>
          </div>
        </div>

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
            © 2026 Hotel Plus Rate Sentinel. All rates fetched via SerpApi.
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
