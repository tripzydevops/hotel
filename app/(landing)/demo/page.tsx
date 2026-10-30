"use client";

import Link from "next/link";
import RateIntelligenceGrid from "@/components/features/analysis/RateIntelligenceGrid";
import { ArrowLeft, Sparkles, ShieldCheck, Activity } from "lucide-react";

const SAMPLE_COMPETITORS = [
  { id: "comp_hilton", name: "Hilton Garden Inn" },
  { id: "comp_altin", name: "Altın Otel" },
  { id: "comp_ramada", name: "Ramada Residences" },
];

// Fixed dates for 100% deterministic visual regression testing and enterprise demo
const SAMPLE_DAILY_PRICES = [
  {
    date: "2026-11-01",
    check_out_date: "2026-11-02",
    price: 3890,
    comp_avg: 4396,
    vs_comp: -11.5,
    intraday_events: [
      { price: 4100, recorded_at: "2026-11-01T08:00:00Z", label: "price scan" },
      { price: 3890, recorded_at: "2026-11-01T12:00:00Z", label: "force scan" },
    ],
    competitors: [
      { name: "Hilton Garden Inn", price: 4120 },
      { name: "Altın Otel", price: 5119 },
      { name: "Ramada Residences", price: 3949 },
    ],
  },
  {
    date: "2026-11-02",
    check_out_date: "2026-11-03",
    price: 3950,
    comp_avg: 4250,
    vs_comp: -7.0,
    competitors: [
      { name: "Hilton Garden Inn", price: 4050 },
      { name: "Altın Otel", price: 4800 },
      { name: "Ramada Residences", price: 3900 },
    ],
  },
  {
    date: "2026-11-03",
    check_out_date: "2026-11-04",
    price: 4100,
    comp_avg: 4320,
    vs_comp: -5.1,
    competitors: [
      { name: "Hilton Garden Inn", price: 4150 },
      { name: "Altın Otel", price: 4900 },
      { name: "Ramada Residences", price: 3910 },
    ],
  },
  {
    date: "2026-11-04",
    check_out_date: "2026-11-05",
    price: 4200,
    comp_avg: 4400,
    vs_comp: -4.5,
    competitors: [
      { name: "Hilton Garden Inn", price: 4250 },
      { name: "Altın Otel", price: 5100 },
      { name: "Ramada Residences", price: 3850 },
    ],
  },
  {
    date: "2026-11-05",
    check_out_date: "2026-11-06",
    price: 4350,
    comp_avg: 4500,
    vs_comp: -3.3,
    competitors: [
      { name: "Hilton Garden Inn", price: 4400 },
      { name: "Altın Otel", price: 5200 },
      { name: "Ramada Residences", price: 3900 },
    ],
  },
  {
    date: "2026-11-06",
    check_out_date: "2026-11-07",
    price: 4950,
    comp_avg: 5100,
    vs_comp: -2.9,
    competitors: [
      { name: "Hilton Garden Inn", price: 5100 },
      { name: "Altın Otel", price: 5800 },
      { name: "Ramada Residences", price: 4400 },
    ],
  },
  {
    date: "2026-11-07",
    check_out_date: "2026-11-08",
    price: 5200,
    comp_avg: 5350,
    vs_comp: -2.8,
    competitors: [
      { name: "Hilton Garden Inn", price: 5400 },
      { name: "Altın Otel", price: 6100 },
      { name: "Ramada Residences", price: 4550 },
    ],
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black text-[var(--soft-gold)] uppercase tracking-widest hover:opacity-80 transition-opacity mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              14-Day Rate Intelligence Demo
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--soft-gold)] text-[var(--deep-ocean)]">
                Live Preview
              </span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Explore autonomous competitor rate benchmarking, parity discovery, and intraday event tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--soft-gold)] text-[var(--deep-ocean)] hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[var(--soft-gold)]" />
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">AI Persona Engine</div>
              <div className="text-[11px] text-[var(--text-muted)]">Automatic attention weighting</div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <Activity className="w-5 h-5 text-[var(--optimal-green)]" />
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">Intraday Scans</div>
              <div className="text-[11px] text-[var(--text-muted)]">Sub-hour rate change detection</div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">Zero Cold Start</div>
              <div className="text-[11px] text-[var(--text-muted)]">Instant competitor bootstrapping</div>
            </div>
          </div>
        </div>

        {/* Rate Intelligence Grid Demonstration */}
        <div className="mt-8">
          <RateIntelligenceGrid
            dailyPrices={SAMPLE_DAILY_PRICES}
            competitors={SAMPLE_COMPETITORS}
            currency="TRY"
            hotelName="Grand Tripzy Resort"
          />
        </div>
      </div>
    </div>
  );
}
