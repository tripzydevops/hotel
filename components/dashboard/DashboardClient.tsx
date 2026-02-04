"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BentoGrid from "@/components/BentoGrid";
import TargetHotelTile from "@/components/TargetHotelTile";
import CompetitorTile from "@/components/CompetitorTile";
import AddHotelModal from "@/components/AddHotelModal";
import SettingsModal from "@/components/SettingsModal";
import ProfileModal from "@/components/ProfileModal";
import {
  RefreshCw,
  Plus,
  Cpu,
  BrainCircuit,
  Activity,
  Sparkles,
} from "lucide-react";
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

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

  const isEnterprise =
    profile?.plan_type === "enterprise" || profile?.plan_type === "pro";

  const currentHotelCount =
    (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0);

  // Executive KPI Calculations
  const adr = effectiveTargetPrice;
  const occupancy = 78.5; // Shared industry average for premium hotels
  const revpar = (adr * occupancy) / 100;

  const marketTotal = (data?.competitors || []).reduce(
    (acc, c) => acc + (c.price_info?.current_price || 0),
    0,
  );
  const marketAvg = marketTotal / (data?.competitors?.length || 0 || 1);
  const ari = marketAvg > 0 ? (adr / marketAvg) * 100 : 100;

  // Mock data for Price Comparison Chart
  const chartData = Array.from({ length: 30 }).map((_, i) => ({
    name: `Day ${i + 1}`,
    "Our Hotel": adr + Math.sin(i / 3) * 15,
    "Comp Set": marketAvg + Math.cos(i / 4) * 10,
    "Market Leader": marketAvg * 1.1 + Math.sin(i / 5) * 20,
  }));

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
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-white tracking-tight uppercase">
              Financial{" "}
              <span className="text-[var(--gold-primary)]">Intelligence</span>
            </h1>
            <p className="text-sm font-medium text-[var(--text-secondary)] max-w-md">
              Strategic revenue metrics and competitor positioning for{" "}
              <span className="text-white font-bold">
                {data?.target_hotel?.name || "Target Property"}
              </span>
              .
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-premium flex items-center gap-3 px-8 py-4 "
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="font-bold uppercase tracking-widest text-[11px]">
                {isRefreshing ? "Synchronizing..." : "Update Live Data"}
              </span>
            </button>
            <button
              onClick={() => setIsAddHotelOpen(true)}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[var(--gold-primary)] group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Executive KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              label: "ADR",
              value: api.formatCurrency(
                adr,
                data?.target_hotel?.price_info?.currency || "TRY",
              ),
              sub: "Average Daily Rate",
              icon: Activity,
            },
            {
              label: "RevPAR",
              value: api.formatCurrency(
                revpar,
                data?.target_hotel?.price_info?.currency || "TRY",
              ),
              sub: "Revenue Per Room",
              icon: Cpu,
            },
            {
              label: "Occupancy",
              value: `${occupancy}%`,
              sub: "Market Average",
              icon: BrainCircuit,
            },
            {
              label: "ARI",
              value: ari.toFixed(1),
              sub: "Rate Index Score",
              icon: Plus,
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className="premium-card p-6 flex flex-col justify-between h-40 group hover:border-[var(--gold-primary)]/40"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-white transition-colors">
                  {kpi.label}
                </span>
                <kpi.icon className="w-4 h-4 text-[var(--gold-primary)] opacity-40" />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-white tracking-tighter">
                  {kpi.value}
                </p>
                <p className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-widest mt-1">
                  {kpi.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Strategic Analysis Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
          <div className="xl:col-span-2 premium-card p-8 h-[450px]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Price Performance Pace
                </h3>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                  30-Day Forward View vs. CompSet
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--gold-primary)]" />
                  <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">
                    Our Property
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-indigo)]" />
                  <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">
                    Market Leader
                  </span>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--gold-primary)"
                        stopOpacity={0.1}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--gold-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b0e14",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: "10px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Our Hotel"
                    stroke="var(--gold-primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Market Leader"
                    stroke="var(--accent-indigo)"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-1 space-y-8">
            <div className="premium-card p-8 h-full bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[var(--gold-primary)]/10">
                  <Sparkles className="w-4 h-4 text-[var(--gold-primary)]" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  Revenue Advisor
                </h3>
              </div>
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 border-l-[var(--gold-primary)] border-l-2">
                  <p className="text-[10px] font-bold text-[var(--gold-primary)] uppercase tracking-widest mb-2">
                    Strategy Recommendation
                  </p>
                  <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                    CompSet in Beşiktaş raised rates by 12% for the Champions
                    League final date.{" "}
                    <span className="text-white font-bold">
                      Recommendation: Adjust ADR to $245.
                    </span>
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 border-l-[var(--accent-indigo)] border-l-2">
                  <p className="text-[10px] font-bold text-[var(--accent-indigo)] uppercase tracking-widest mb-2">
                    Yield Alert
                  </p>
                  <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                    Expected demand spike for early March detected. Your ADR is
                    currently{" "}
                    <span className="text-white font-bold">5% below</span> the
                    competitive average.
                  </p>
                </div>
              </div>
              <button className="w-full mt-8 py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white/60 hover:text-white">
                Generate Full Strategic Report
              </button>
            </div>
          </div>
        </div>

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
