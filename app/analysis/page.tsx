"use client";

import Header from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, BarChart, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AnalysisPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen pb-12">
      <Header />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="p-6 rounded-full bg-white/5 mb-8">
            <TrendingUp className="w-16 h-16 text-[var(--soft-gold)]" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            {t("common.analysis")}
          </h1>
          <p className="text-[var(--text-secondary)] max-w-lg mb-8">
            Advanced AI-driven analysis of your competitor's pricing strategies
            and market positioning is coming soon.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <div className="glass-card p-6 text-left">
              <BarChart className="w-8 h-8 text-[var(--soft-gold)] mb-4" />
              <h3 className="text-white font-bold mb-2">Market Insights</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Real-time trends and historical patterns visualized.
              </p>
            </div>
            <div className="glass-card p-6 text-left opacity-50">
              <ShieldAlert className="w-8 h-8 text-[var(--soft-gold)] mb-4" />
              <h3 className="text-white font-bold mb-2">Predictive Alerts</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Get notified before competitors change their rates.
              </p>
            </div>
            <div className="glass-card p-6 text-left opacity-50">
              <TrendingUp className="w-8 h-8 text-[var(--soft-gold)] mb-4" />
              <h3 className="text-white font-bold mb-2">Strategy Planner</h3>
              <p className="text-sm text-[var(--text-muted)]">
                AI-recommended pricing for your hotel.
              </p>
            </div>
          </div>

          <Link href="/" className="btn-gold px-8 py-3 mt-12 font-bold">
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
