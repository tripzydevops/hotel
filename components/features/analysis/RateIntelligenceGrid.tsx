"use client";

import { useI18n } from "@/lib/i18n";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  History,
  Clock,
} from "lucide-react";

interface Competitor {
  id: string;
  name: string;
}

interface IntradayEvent {
  price: number;
  recorded_at: string;
  vendor?: string;
  label?: string;
}

interface DailyPrice {
  date: string;
  check_out_date?: string;
  price: number;
  comp_avg: number;
  vs_comp: number;
  is_estimated_target?: boolean;
  intraday_events?: IntradayEvent[];
  competitors: {
    name: string;
    price: number;
    is_estimated?: boolean;
    intraday_events?: IntradayEvent[];
  }[];
}

interface RateIntelligenceGridProps {
  dailyPrices: DailyPrice[];
  competitors: Competitor[];
  currency: string;
  hotelName?: string;
}

const IntradayIndicator = ({ events, symbol }: { events: IntradayEvent[], symbol: string }) => {
  const { t } = useI18n();
  if (!events || events.length === 0) return null;

  return (
    <div className="absolute top-1 left-1 group/intraday z-20">
      <div className="p-0.5 rounded bg-[var(--glass-bg-subtle)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--soft-gold)] transition-colors cursor-help">
        <Clock className="w-2 h-2" />
      </div>

      {/* Tooltip Content */}
      <div className="absolute top-0 left-full ml-2 w-48 p-3 bg-[var(--deep-ocean)]/95 backdrop-blur-xl border border-[var(--soft-gold)]/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 translate-x-2 group-hover/intraday:opacity-100 group-hover/intraday:translate-x-0 pointer-events-none transition-all duration-300 z-50 overflow-hidden">
        {/* Subtle glow background */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[var(--soft-gold)]/10 rounded-full blur-2xl" />

        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--glass-border)] relative">
          <History className="w-3 h-3 text-[var(--soft-gold)]" />
          <span className="text-[9px] font-black uppercase text-[var(--overlay-text)] tracking-[0.2em]">{t("intradayStory.modalTitle")}</span>
        </div>

        <div className="flex flex-col relative before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gradient-to-b before:from-[var(--soft-gold)]/40 before:to-transparent">
          {events.map((ev, idx) => {
            const rawLabel = ev.label || "";
            const displayLabel = rawLabel.toLowerCase() === "force scan"
              ? "Live Check"
              : rawLabel.toLowerCase() === "price scan"
                ? "Automated Check"
                : t(`intradayStory.labels.${rawLabel}`, { defaultValue: rawLabel.replace(/_/g, " ") });

            return (
              <div key={idx} className="relative pl-4 pb-3 last:pb-0 group/step">
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-1 w-1.5 h-1.5 rounded-full z-10 transition-transform duration-300 group-hover/step:scale-150 ${idx === 0 ? "bg-[var(--soft-gold)] shadow-[0_0_5px_var(--soft-gold)]" : "bg-white/30 border border-white/50"}`} />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col items-start translate-y-[-2px]">
                    <span className="text-[10px] font-black text-[var(--overlay-text)]/90 uppercase tracking-wider leading-none">
                      {new Date(ev.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {displayLabel && (
                      <span className="text-[7px] font-black text-[var(--soft-gold)]/80 uppercase tracking-widest mt-1">
                        {displayLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-black text-[var(--overlay-text)] tracking-tight bg-white/5 px-1.5 py-0.5 rounded shadow-inner border border-[var(--overlay-border)]">
                    {symbol}{ev.price.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
};

/**
 * RateIntelligenceGrid Component
 * 
 * Displays a 14-day price comparison table between the target hotel and its competitors.
 * Features:
 * - Sticky columns for Dates
 * - Best Price highlighting (Green)
 * - Trend indicators (vs Market Avg)
 * - Price difference percentage calculation
 */
export default function RateIntelligenceGrid({
  dailyPrices,
  competitors,
  currency,
  hotelName = "My Hotel",
}: RateIntelligenceGridProps) {
  const { t, locale } = useI18n();
  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  // Provide a safe default if competitors is somehow undefined or empty
  // Use a Set to collect ALL unique competitors seen in the daily prices if the prop is empty
  // (This handles cases where the prop might be missing but data exists in rows)
  const effectiveCompetitors =
    competitors && competitors.length > 0
      ? competitors
      : Array.from(
        new Set(dailyPrices.flatMap((d) => d.competitors.map((c) => c.name))),
      ).map((name) => ({ id: name, name })); // Mock ID as name

  // Sort dates ascending
  const sortedData = [...dailyPrices].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="glass-card p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-1">
            {t("rateIntelligence.title")}
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            {t("rateIntelligence.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--glass-bg-accent)] border border-[var(--glass-border-accent)] text-[var(--soft-gold)] text-xs font-black uppercase tracking-wider">
            {t("rateIntelligence.daysCount", { 0: sortedData.length })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto relative rounded-xl border border-[var(--glass-border)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {/* Date Column */}
              <th className="sticky left-0 z-20 bg-[var(--deep-ocean)]/95 backdrop-blur-xl p-4 min-w-[140px] border-b border-r border-[var(--glass-border)] text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                {t("rateIntelligence.dateRange")}
              </th>

              {/* My Hotel Column */}
              <th className="p-4 min-w-[140px] border-b border-[var(--glass-border)] bg-[var(--glass-bg-accent)] border-r border-[var(--glass-border-accent)] text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest">
                    {hotelName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-[9px] font-black uppercase">
                    {t("common.you")}
                  </span>
                </div>
              </th>

              {/* Competitor Columns */}
              {effectiveCompetitors.map((comp) => (
                <th
                  key={comp.id}
                  className="p-4 min-w-[140px] border-b border-[var(--glass-border)] text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider truncate max-w-[120px]">
                      {comp.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {sortedData.slice(0, 14).map((row) => {
              const dateObj = new Date(row.date);
              const isWeekend =
                dateObj.getDay() === 0 || dateObj.getDay() === 6; // Sun or Sat

              // Find lowest price in row to mark "Best Position"
              const allPrices = [
                row.price,
                ...row.competitors.map((c) => c.price),
              ].filter((p) => p > 0);
              const minPrice = Math.min(...allPrices);
              const isMyPriceLowest = row.price === minPrice && row.price > 0;

              return (
                <tr
                  key={row.date}
                  className="hover:bg-[var(--glass-bg-subtle)] transition-colors group"
                >
                  {/* Date Cell */}
                  <td className="sticky left-0 z-10 bg-[var(--deep-ocean)]/95 backdrop-blur-xl p-4 border-r border-[var(--glass-border)] group-hover:bg-[var(--deep-ocean)]">
                    <div className="flex flex-col">
                      <div className="flex flex-col mb-1">
                        <span className="text-sm font-black text-[var(--text-primary)] leading-tight">
                          {dateObj.toLocaleDateString(
                            locale === "en" ? "en-US" : "tr-TR",
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                        {row.check_out_date && (
                          <div className="flex items-center gap-1 opacity-60">
                            <div className="w-1 h-px bg-[var(--text-muted)]" />
                            <span className="text-[10px] font-bold text-[var(--text-muted)]">
                              {new Date(row.check_out_date).toLocaleDateString(
                                locale === "en" ? "en-US" : "tr-TR",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {dateObj.toLocaleDateString(
                          locale === "en" ? "en-US" : "tr-TR",
                          { weekday: "long" },
                        )}
                        {isWeekend && (
                          <span className="ml-1.5 text-[var(--soft-gold)]">
                            ★
                          </span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* My Price Cell */}
                  <td
                    className={`p-4 border-r border-[var(--glass-border-subtle)] text-center relative ${isMyPriceLowest ? "bg-[var(--optimal-green)]/10" : ""}`}
                  >
                    {row.price > 0 ? (
                      <div className={`flex flex-col items-center ${row.is_estimated_target ? "opacity-60 grayscale-[0.5]" : ""}`}>
                        {/* Intraday Indicator */}
                        <IntradayIndicator events={row.intraday_events || []} symbol={symbol} />

                        {row.is_estimated_target && (
                          <div className="absolute top-1.5 right-1.5 opacity-100 z-10">
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-400/20 bg-amber-400/10 text-amber-400 animate-pulse cursor-help"
                              title={t("common.estimated") || "ESTIMATED / SOLD OUT"}
                            >
                              <AlertTriangle className="w-2 h-2" />
                              <span className="text-[7px] font-black uppercase tracking-tighter whitespace-nowrap">
                                {t("common.estimated") || "ESTIMATED"}
                              </span>
                            </div>
                          </div>
                        )}
                        <span
                          className={`text-sm font-black ${isMyPriceLowest ? "text-[var(--optimal-green)]" : "text-[var(--soft-gold)]"} ${row.is_estimated_target ? "decoration-dotted underline decoration-[var(--text-muted)]" : ""}`}
                        >
                          {symbol}
                          {row.price.toLocaleString()}
                        </span>
                        {/* Trend Indicator based on Comp Avg */}
                        {row.vs_comp !== 0 && (
                          <div
                            className={`flex items-center gap-0.5 text-[9px] font-black uppercase mt-1 ${row.vs_comp > 0 ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}
                          >
                            {row.vs_comp > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {Math.abs(row.vs_comp)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                        N/A
                      </div>
                    )}

                    {/* Best Rate Marker */}
                    {isMyPriceLowest && (
                      <div
                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]"
                        title={t("rateIntelligence.lowestRate")}
                      />
                    )}
                  </td>

                  {effectiveCompetitors.map((comp) => {
                    const compPriceData = row.competitors.find(
                      (c) => c.name === comp.name,
                    );
                    const price = compPriceData?.price || 0;
                    const isEstimated = compPriceData?.is_estimated;

                    // Comparison Logic
                    let diffPercent = 0;
                    if (row.price > 0 && price > 0) {
                      diffPercent = ((price - row.price) / row.price) * 100;
                    }

                    const isCheaper = price > 0 && price < row.price;
                    const isMoreExpensive = price > 0 && price > row.price;

                    // EXPLANATION: Verification Failed Status
                    // If we have a record (compPriceData exists) but price is 0,
                    // it means the scan ran but found no price (and no history to fill from).
                    // We interpret this as "Verification Failed" per user request.
                    const isVerificationFailed = compPriceData && price === 0;

                    return (
                      <td
                        key={comp.id}
                        className="p-4 text-center border-b border-[var(--glass-border)] relative group/cell"
                      >
                        {price > 0 ? (
                          <div className={`flex flex-col items-center ${isEstimated ? "opacity-60 grayscale-[0.5]" : ""}`}>
                            {/* Intraday Indicator */}
                            <IntradayIndicator events={compPriceData?.intraday_events || []} symbol={symbol} />

                            {isEstimated && (
                              <div className="absolute top-1.5 right-1.5 opacity-100 z-10">
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-400/20 bg-amber-400/10 text-amber-400 animate-pulse cursor-help"
                                  title={t("common.estimated") || "ESTIMATED / SOLD OUT"}
                                >
                                  <AlertTriangle className="w-2 h-2" />
                                  <span className="text-[7px] font-black uppercase tracking-tighter whitespace-nowrap">
                                    {t("common.estimated") || "ESTIMATED"}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-sm font-bold ${isCheaper ? "text-[var(--optimal-green)]" : isMoreExpensive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"} ${isEstimated ? "decoration-dotted underline decoration-[var(--text-muted)]" : ""}`}
                              >
                                {symbol}
                                {price.toLocaleString()}
                              </span>
                            </div>
                            {/* Diff Badge */}
                            {diffPercent !== 0 && (
                              <span
                                className={`text-[8px] font-black px-1.5 py-0.5 rounded mt-1 bg-[var(--glass-bg-subtle)] ${diffPercent > 0 ? "text-[var(--optimal-green)]" : "text-[var(--alert-red)]"}`}
                              >
                                {diffPercent > 0 ? "+" : ""}
                                {diffPercent.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : isVerificationFailed ? (
                          <div className="flex flex-col items-center justify-center opacity-70">
                            <div className="px-1.5 py-0.5 rounded border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] flex items-center gap-1" title={t("rateIntelligence.notAvailable")}>
                              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
                                N/A
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xl text-[var(--text-muted)]/20">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-6 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest pl-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]" />
          {t("rateIntelligence.bestPosition")}
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-[var(--alert-red)]" />
          {t("rateIntelligence.aboveAvg")}
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-3 h-3 text-[var(--optimal-green)]" />
          {t("rateIntelligence.belowAvg")}
        </div>
      </div>
    </div>
  );
}
