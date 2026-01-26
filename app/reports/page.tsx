"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
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
} from "lucide-react";
import { api } from "@/lib/api";
import ScanSessionModal from "@/components/ScanSessionModal";
import { ScanSession } from "@/types";
import { createClient } from "@/utils/supabase/client";

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(
    null,
  );
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  /* Profile State for Header */
  const [profile, setProfile] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const hotelCount = 0;

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
      try {
        const result = await api.getReports(userId);
        setData(result);
      } catch (err) {
        console.error("Failed to load reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

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

        // Weekly Summary
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(t("reports.weeklySummary"), 14, 40);

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
          startY: 45,
          head: [[t("reports.timestamp"), "Value"]],
          body: summaryData,
          theme: "grid",
          headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] },
          styles: { fontSize: 10 },
        });

        // Sessions Table
        const lastY = (doc as any).lastAutoTable.finalY || 60;
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

        doc.save(`hotel-reports-${new Date().toISOString().split("T")[0]}.pdf`);
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

  if (loading) {
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
    <div className="min-h-screen pb-12 bg-[var(--deep-ocean)]">
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
                <FileText className="w-5 h-5" />
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

        {/* Weekly Summary Brief */}
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

        {/* Scan History Log Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[var(--soft-gold)]" />
              <h2 className="text-lg font-black text-white">
                {t("reports.fullHistoryLog")}
              </h2>
            </div>
            <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">
              {t("reports.recent20Sessions")}
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
