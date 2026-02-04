"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BentoGrid from "@/components/BentoGrid";
import TargetHotelTile from "@/components/TargetHotelTile";
import CompetitorTile from "@/components/CompetitorTile";
import AddHotelModal from "@/components/AddHotelModal";
import SettingsModal from "@/components/SettingsModal";
import ProfileModal from "@/components/ProfileModal";
import { RefreshCw, Plus, Cpu, BrainCircuit, Activity } from "lucide-react";
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
import CommandLayout from "@/components/layout/CommandLayout";

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
    <CommandLayout userProfile={profile} activeRoute="dashboard">
      {isLocked && (
        <PaywallOverlay
          reason={
            profile?.subscription_status === "canceled"
              ? "Subscription Canceled"
              : "Trial Expired"
          }
        />
      )}

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

      <div className="pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 mb-16 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-12 bg-[var(--gold-gradient)] rounded-full hidden sm:block shadow-[0_0_20px_rgba(212,175,55,0.3)]" />
              <div className="flex flex-col">
                <h1 className="text-5xl font-black text-white tracking-tighter flex items-center gap-6 italic leading-none">
                  DASHBOARD
                </h1>
                <p className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.6em] mt-3 opacity-80 pl-1">
                  Competitor Rate Overview
                </p>
              </div>
            </div>
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

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`
                btn-premium flex items-center gap-4 px-10 py-5 shadow-[0_20px_40px_rgba(212,175,55,0.15)] relative overflow-hidden group/btn
                ${isRefreshing ? "opacity-75 cursor-wait" : "hover:scale-105 active:scale-95 transition-all duration-300"}
              `}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              <RefreshCw
                className={`w-5 h-5 text-black relative z-10 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="font-black tracking-[0.4em] uppercase text-sm text-black relative z-10">
                {isRefreshing ? "UPDATING PRICES" : "REFRESH LIVE RATES"}
              </span>
            </button>

            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="p-5 rounded-2xl bg-black border border-white/5 hover:bg-white/5 hover:border-[var(--gold-primary)]/40 text-white transition-all transform hover:rotate-90 shadow-2xl group/add"
              title="Add Node"
            >
              <Plus className="w-6 h-6 text-[var(--gold-primary)] group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* 2026 Agentic Insight Panel */}
        {data?.competitors?.length && (
          <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReasoningShard
              title="Market Update Advisory"
              insight="Competitor rates are showing downward movement in your area. Consider adjusting your ADR for upcoming weekend slots."
              type="warning"
              className="md:col-span-2 shadow-2xl"
            />
            <div className="premium-card p-8 flex flex-col justify-center items-center text-center bg-black/60 border-[var(--gold-glow)]/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--gold-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mb-4 relative z-10">
                Monitoring Status
              </span>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-3 h-3 rounded-full bg-[var(--gold-primary)] shadow-[0_0_20px_var(--gold-primary)] animate-pulse" />
                <span className="text-2xl font-black text-white tracking-tighter uppercase italic">
                  ADVISOR_READY
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 mt-2 relative z-10">
                <Activity
                  size={14}
                  className="text-[var(--gold-primary)] animate-bounce"
                />
                <span className="text-[10px] font-black text-[var(--gold-primary)] tracking-[0.3em] leading-none uppercase">
                  Connected
                </span>
              </div>
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

        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="premium-card p-8 text-center bg-black/40 border-red-500/10 hover:border-red-500/40 shadow-2xl transition-all group">
            <div className="absolute top-0 inset-x-0 h-1 bg-red-500/10" />
            <p className="text-5xl font-black text-red-500 data-value drop-shadow-[0_0_15px_rgba(239,68,68,0.4)] group-hover:scale-110 transition-transform">
              {
                (data?.competitors || []).filter(
                  (c) =>
                    c.price_info &&
                    c.price_info.current_price < effectiveTargetPrice,
                ).length
              }
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mt-4">
              Price Under-cuts
            </p>
          </div>
          <div className="premium-card p-8 text-center bg-black/40 border-emerald-500/10 hover:border-emerald-500/40 shadow-2xl transition-all group">
            <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500/10" />
            <p className="text-5xl font-black text-emerald-400 data-value drop-shadow-[0_0_15px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-transform">
              {
                (data?.competitors || []).filter(
                  (c) => c.price_info?.trend === "down",
                ).length
              }
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mt-4">
              Market Declines
            </p>
          </div>
          <div className="premium-card p-8 text-center bg-black/40 border-[var(--gold-glow)]/20 hover:border-[var(--gold-primary)]/40 shadow-2xl transition-all group">
            <div className="absolute top-0 inset-x-0 h-1 bg-[var(--gold-primary)]/10" />
            <p className="text-4xl font-black text-white group-hover:text-[var(--gold-primary)] transition-all">
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
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mt-4">
              Avg Market Rate
            </p>
          </div>
          <div className="premium-card p-8 text-center bg-black/40 border-blue-500/10 hover:border-blue-500/40 shadow-2xl transition-all group">
            <div className="absolute top-0 inset-x-0 h-1 bg-blue-500/10" />
            <p className="text-5xl font-black text-white group-hover:text-blue-400 transition-all">
              {currentHotelCount}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mt-4">
              Tracked Hotels
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

        <footer className="mt-32 py-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em]">
              © 2026 HOTEL RATE SENTINEL
            </p>
            <p className="text-[var(--text-muted)] text-[8px] font-mono tracking-widest opacity-40 uppercase">
              Professional Competitor Intelligence for Revenue Management.
            </p>
          </div>
          <div className="flex gap-8">
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all text-[10px] font-black uppercase tracking-[0.3em]"
            >
              Privacy_Policy
            </a>
            <a
              href="#"
              className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all text-[10px] font-black uppercase tracking-[0.3em]"
            >
              Terms_of_Service
            </a>
          </div>
        </footer>
      </div>
    </CommandLayout>
  );
}
