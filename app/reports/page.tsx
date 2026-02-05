"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileType,
  Activity,
  History,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { api } from "@/lib/api";
import ScanSessionModal from "@/components/modals/ScanSessionModal";
import { ScanSession, MarketAnalysis } from "@/types";
import { createClient } from "@/utils/supabase/client";
import MarketPositionChart from "@/components/analytics/MarketPositionChart";
import PriceTrendChart from "@/components/analytics/PriceTrendChart";
import { PaywallOverlay } from "@/components/ui/PaywallOverlay";

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(
    null,
  );
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [currency, setCurrency] = useState("TRY");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const hotelCount = 0; // Updated dynamically if needed via context or separate fetch

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        try {
          const userProfile = await api.getProfile(session.user.id);
          setProfile(userProfile);
          if (userProfile?.preferred_currency) {
            setCurrency(userProfile.preferred_currency);
          }
        } catch (e) {
          console.error("Failed to fetch profile", e);
        }
      } else {
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!userId) return;
      setLoading(true);
      try {
        const [reportsResult, analysisResult] = await Promise.all([
          api.getReports(userId),
          api.getAnalysis(userId, currency),
        ]);
        setData(reportsResult);
        setAnalysis(analysisResult);
      } catch (err) {
        console.error("Failed to load reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId, currency]);

  const handleExport = async (format: string) => {
    if (!userId) return;
    setExporting(format);

    try {
      if (format === "pdf") {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text("Hotel Rate Sentinel - Intelligence Report", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Currency: ${currency}`, 14, 32);

        // Weekly Summary
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(t("reports.weeklySummary"), 14, 45);

        const summaryData = [
          [t("reports.totalPulses"), data?.weekly_summary?.total_scans || 0],
          [
            t("reports.activeIntelligence"),
            data?.weekly_summary?.active_monitors || 0,
          ],
          [
            t("reports.weeklyTrend"),
            data?.weekly_summary?.last_week_trend || "N/A",
          ],
          [
            t("reports.systemHealth"),
            data?.weekly_summary?.system_health || "N/A",
          ],
        ];

        autoTable(doc, {
          startY: 50,
          head: [[t("reports.timestamp"), "Value"]],
          body: summaryData,
          theme: "grid",
          headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] },
          styles: { fontSize: 10 },
        });

        // Sessions Table
        const lastY = (doc as any).lastAutoTable.finalY || 65;
        doc.setFontSize(14);
        doc.text(t("reports.fullHistoryLog"), 14, lastY + 15);

        const tableData =
          data?.sessions?.map((s: any) => [
            new Date(s.created_at).toLocaleString(),
            s.session_type?.toUpperCase(),
            s.status?.toUpperCase(),
            s.hotels_count,
          ]) || [];

        autoTable(doc, {
          startY: lastY + 20,
          head: [
            [
              t("reports.timestamp"),
              t("reports.sessionType"),
              t("reports.status"),
              t("reports.hotelsScanned"),
            ],
          ],
          body: tableData,
          theme: "striped",
          headStyles: { fillColor: [40, 40, 40] },
        });

        doc.save(
          `hotel-reports-${currency}-${new Date().toISOString().split("T")[0]}.pdf`,
        );
      } else {
        await api.exportReport(userId, format);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  const handleOpenSession = (session: ScanSession) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const isLocked =
    profile?.subscription_status === "past_due" ||
    profile?.subscription_status === "canceled" ||
    profile?.subscription_status === "unpaid";

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--soft-gold)] font-black uppercase tracking-widest text-[10px]">
            {t("reports.compiling")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 bg-[var(--deep-ocean)] transition-all">
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
        hotelCount={hotelCount}
        unreadCount={0}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
      />

      <ScanSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        session={selectedSession}
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                {t("reports.title")}
              </h1>
            </div>
            <p className="text-[var(--text-secondary)] font-medium">
              {t("reports.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                {t("reports.currencyLabel")}
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent text-xs font-bold text-white border-none focus:ring-0 cursor-pointer"
              >
                <option value="USD" className="bg-[var(--deep-ocean)]">
                  USD ($)
                </option>
                <option value="EUR" className="bg-[var(--deep-ocean)]">
                  EUR (€)
                </option>
                <option value="TRY" className="bg-[var(--deep-ocean)]">
                  TRY (₺)
                </option>
                <option value="GBP" className="bg-[var(--deep-ocean)]">
                  GBP (£)
                </option>
              </select>
            </div>

            <button
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
              className="btn-ghost flex items-center gap-2 group"
            >
              <FileSpreadsheet className="w-4 h-4 group-hover:text-[var(--soft-gold)] transition-colors" />
              <span className="text-xs font-black uppercase tracking-widest">
                {exporting === "csv"
                  ? t("reports.exporting")
                  : t("reports.exportCsv")}
              </span>
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              className="btn-gold flex items-center gap-2"
            >
              <FileType className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">
                {exporting === "pdf"
                  ? t("reports.exporting")
                  : t("reports.exportPdf")}
              </span>
            </button>
          </div>
        </div>

        {/* --- STRATEGIC INTELLIGENCE LAYER --- */}
        {analysis && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-[var(--soft-gold)] rounded-full mr-1" />
                {t("reports.strategicIntelligence")}
              </h2>
              <p className="text-sm text-[var(--text-muted)] font-medium mt-1">
                {t("reports.quadrantDesc")}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Quadrant Visual Placeholder or Mini Map */}
              <div className="lg:col-span-2 glass-card p-6 flex flex-col items-center justify-center min-h-[300px] border border-[var(--soft-gold)]/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 w-full h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--soft-gold)]">
                      {t("reports.quadrantTitle")}
                    </h4>
                    <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter bg-[var(--soft-gold)] text-[var(--deep-ocean)]">
                      Autonomous
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 border-2 border-dashed border-white/10 rounded-xl p-4 relative">
                    {/* Quadrant Labels */}
                    <div className="border border-white/5 flex flex-col items-center justify-center rounded-lg bg-white/5 hover:bg-[var(--optimal-green)]/10 transition-colors group/q">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] group-hover/q:text-[var(--optimal-green)]">
                        {t("reports.underpriced")}
                      </span>
                    </div>
                    <div className="border border-white/5 flex flex-col items-center justify-center rounded-lg bg-white/5 hover:bg-blue-500/10 transition-colors group/q">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] group-hover/q:text-blue-400">
                        {t("reports.valuePremium")}
                      </span>
                    </div>
                    <div className="border border-white/5 flex flex-col items-center justify-center rounded-lg bg-white/5 hover:bg-alert-red/10 transition-colors group/q">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] group-hover/q:text-alert-red">
                        {t("reports.lostValue")}
                      </span>
                    </div>
                    <div className="border border-white/5 flex flex-col items-center justify-center rounded-lg bg-white/5 hover:bg-amber-500/10 transition-colors group/q">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] group-hover/q:text-amber-400">
                        {t("reports.overpriced")}
                      </span>
                    </div>

                    {/* Actual Pointer */}
                    <div
                      className="absolute w-4 h-4 bg-[var(--soft-gold)] rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,215,0,0.5)] animate-pulse"
                      style={{
                        left: `${Math.min(90, Math.max(10, (analysis.sentiment_index || 100) / 2))}%`,
                        top: `${Math.min(90, Math.max(10, 100 - (analysis.ari || 100) / 2))}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-medium italic">
                    <Lightbulb className="w-3 h-3 text-[var(--soft-gold)]" />
                    {analysis.ari && analysis.ari > 105
                      ? t("reports.highPosition")
                      : t("reports.lowPosition")}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ARI Card */}
                <div className="glass-card p-6 flex flex-col justify-between border-t-2 border-t-[var(--soft-gold)]">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      {t("reports.ariLabel")}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight mb-4">
                      {t("reports.ariDesc")}
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-black text-white italic">
                      {analysis.ari || "100.0"}
                    </span>
                    <div
                      className={`px-2 py-1 rounded text-[10px] font-black ${(analysis.ari || 100) > 100 ? "bg-alert-red/10 text-alert-red" : "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)]"}`}
                    >
                      {(analysis.ari || 100) > 100
                        ? t("reports.overpriced")
                        : t("reports.underpriced")}
                    </div>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-[var(--soft-gold)] rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, analysis.ari || 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Sentiment Card */}
                <div className="glass-card p-6 flex flex-col justify-between border-t-2 border-t-blue-500">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      {t("reports.sentimentLabel")}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight mb-4">
                      {t("reports.sentimentDesc")}
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-black text-white italic">
                      {analysis.sentiment_index || "100.0"}
                    </span>
                    <div
                      className={`px-2 py-1 rounded text-[10px] font-black ${(analysis.sentiment_index || 100) > 100 ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)]" : "bg-alert-red/10 text-alert-red"}`}
                    >
                      {(analysis.sentiment_index || 100) > 100
                        ? t("reports.valuePremium")
                        : t("reports.lostValue")}
                    </div>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, analysis.sentiment_index || 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* So What? Card */}
                <div className="md:col-span-2 glass-card p-4 bg-[var(--soft-gold)]/5 border border-dashed border-[var(--soft-gold)]/20 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--soft-gold)]/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <Lightbulb className="w-6 h-6 text-[var(--soft-gold)]" />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--soft-gold)]">
                      {t("reports.soWhat")}
                    </h5>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      {analysis.ari &&
                      analysis.ari < 95 &&
                      analysis.sentiment_index &&
                      analysis.sentiment_index > 105
                        ? "Your 'Underpriced' status combined with 'Value Premium' sentiment suggests an immediate 5-10% rate increase opportunity without losing occupancy."
                        : analysis.ari &&
                            analysis.ari > 105 &&
                            analysis.sentiment_index &&
                            analysis.sentiment_index < 95
                          ? "Warning: High Pricing with low sentiment indicates a 'Value Gap'. You are at risk of major ADR loss if competitors lower rates."
                          : "Market data suggests a balanced pricing position. Monitor Stealth Patterns for unexpected competitor shifts."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- ANALYTICS DASHBOARD --- */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 animate-in slide-in-from-bottom-5 duration-500">
            {/* 1. Market Position Chart */}
            <div className="lg:col-span-1 glass-card p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--soft-gold)]" />
                  {t("reports.marketPosition")}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t("reports.positionDesc")}
                </p>
              </div>
              <div className="flex-1 min-h-[250px]">
                <MarketPositionChart
                  data={{
                    min: analysis.market_min,
                    avg: analysis.market_average,
                    max: analysis.market_max,
                    myPrice: analysis.target_price || null,
                  }}
                  currency={analysis.display_currency}
                />
              </div>
            </div>

            {/* 2. Price Trend Chart */}
            <div className="lg:col-span-2 glass-card p-6 flex flex-col">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--soft-gold)]" />
                    {t("reports.priceVelocity")}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {t("reports.velocityDesc")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: analysis.display_currency,
                      minimumFractionDigits: 0,
                    }).format(analysis.target_price || 0)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">
                    {t("hotelDetails.current")}
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-[250px]">
                <PriceTrendChart
                  history={analysis.price_history}
                  currency={analysis.display_currency}
                />
              </div>
            </div>

            {/* 3. Insight Cards */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rank Card */}
              <div className="glass-card p-6 border-l-4 border-l-[var(--soft-gold)]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">
                    {t("reports.competitiveRank")}
                  </h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {analysis.target_price
                    ? t("reports.rankMsg")
                        .replace("{0}", analysis.competitive_rank.toString())
                        .replace(
                          "{1}",
                          (analysis.competitors.length + 1).toString(),
                        )
                    : t("reports.noData")}
                </p>
              </div>

              {/* Price vs Market Card */}
              <div
                className={`glass-card p-6 border-l-4 ${
                  (analysis.target_price || 0) < analysis.market_average
                    ? "border-l-[var(--optimal-green)]"
                    : "border-l-alert-red"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      (analysis.target_price || 0) < analysis.market_average
                        ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)]"
                        : "bg-alert-red/10 text-alert-red"
                    }`}
                  >
                    {(analysis.target_price || 0) < analysis.market_average ? (
                      <TrendingDown className="w-5 h-5" />
                    ) : (
                      <TrendingUp className="w-5 h-5" />
                    )}
                  </div>
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">
                    {t("reports.marketComparison")}
                  </h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {(analysis.target_price || 0) < analysis.market_average
                    ? t("reports.lowPosition")
                    : t("reports.highPosition")}
                </p>
              </div>

              {/* Action Tip Card */}
              <div className="glass-card p-6 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">
                    {t("reports.proTip")}
                  </h4>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {analysis.market_max - analysis.market_min >
                  analysis.market_average * 0.5
                    ? t("reports.highVolatility")
                    : t("reports.lowVolatility")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Summary Brief (Legacy) */}
        {!analysis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <SummaryCard
              title={t("reports.totalPulses")}
              value={data?.weekly_summary?.total_scans || 0}
              icon={<Activity className="w-5 h-5" />}
            />
            <SummaryCard
              title={t("reports.activeIntelligence")}
              value={data?.weekly_summary?.active_monitors || 0}
              icon={<Activity className="w-5 h-5" />}
            />
            <SummaryCard
              title={t("reports.weeklyTrend")}
              value={data?.weekly_summary?.last_week_trend || "Stable"}
              icon={<Calendar className="w-5 h-5" />}
            />
            <SummaryCard
              title={t("reports.systemHealth")}
              value={data?.weekly_summary?.system_health || "100%"}
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
          </div>
        )}

        {/* Scan History Log Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[var(--soft-gold)]" />
              <h2 className="text-lg font-black text-white">
                {t("reports.fullHistoryLog")}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">
                {t("reports.recent20Sessions")}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {t("reports.timestamp")}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {t("reports.sessionType")}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {t("reports.status")}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {t("reports.hotelsScanned")}
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">
                    {t("reports.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.sessions?.map((session: any) => (
                  <tr
                    key={session.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-white">
                        {new Date(session.created_at).toLocaleDateString(
                          locale === "en" ? "en-US" : "tr-TR",
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-medium">
                        {new Date(session.created_at).toLocaleTimeString(
                          locale === "en" ? "en-US" : "tr-TR",
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-white">
                        {session.session_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {session.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--optimal-green)]" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-xs font-bold text-white capitalize">
                          {session.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-white">
                        {session.hotels_count}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-1 font-bold uppercase">
                        {t("reports.propertiesLabel")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenSession(session)}
                        className="p-2 rounded-lg bg-white/5 group-hover:bg-[var(--soft-gold)] group-hover:text-[var(--deep-ocean)] transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6 border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-white/5 text-[var(--text-muted)]">
          {icon}
        </div>
        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
          {title}
        </span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  );
}
