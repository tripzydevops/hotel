"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Report } from "@/types";
import { FileText, Download, TrendingUp, Users } from "lucide-react";

export default function SavedReportsBrowser() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<Report | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getAdminReports();
        setReports(data);
      } catch (e) {
        console.error("Failed to load reports:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const downloadPdf = async (id: string, title: string) => {
    try {
      // Trigger browser download
      const headers = await api.getHeaders();
      const res = await fetch(`${api.baseURL}/api/admin/reports/${id}/pdf`, {
        headers,
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Failed to download PDF");
    }
  };

  if (loading)
    return (
      <div className="p-8 text-white/50 text-center">Loading Archives...</div>
    );

  if (reports.length === 0) {
    return (
      <div className="p-8 text-center glass-card border-dashed border-slate-700">
        <div className="text-slate-500 mb-2">No saved reports found.</div>
        <div className="text-xs text-slate-600">
          Generate your first report above.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-8">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-blue-400">📂</span> Deployment Archives
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="glass-card p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                {report.report_type === "comparison" ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
                  {report.title}
                </div>
                <div className="text-xs text-slate-500 flex gap-2">
                  <span>
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span className="uppercase">{report.report_type}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => downloadPdf(report.id, report.title)}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
