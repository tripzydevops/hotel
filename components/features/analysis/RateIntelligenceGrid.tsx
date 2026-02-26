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
  if (!events || events.length === 0) return null;

  return (
    <div className="absolute top-1 left-1 group/intraday z-20">
      <div className="p-0.5 rounded bg-white/5 border border-white/10 text-white/40 hover:text-[var(--soft-gold)] transition-colors cursor-help">
        <Clock className="w-2 h-2" />
      </div>

      {/* Tooltip Content */}
      <div className="absolute top-0 left-full ml-2 w-36 p-2 bg-[#0a1622]/95 backdrop-blur-md border border-[var(--soft-gold)]/20 rounded-lg shadow-2xl opacity-0 translate-x-1 group-hover/intraday:opacity-100 group-hover/intraday:translate-x-0 pointer-events-none transition-all z-50">
        <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-white/10">
          <History className="w-2.5 h-2.5 text-[var(--soft-gold)]" />
          <span className="text-[8px] font-black uppercase text-white tracking-widest">Intraday Story</span>
        </div>
        <div className="space-y-1.5">
          {events.map((ev, idx) => (
            <div key={idx} className="flex items-center justify-between gap-1">
              <div className="flex flex-col items-start">
                <span className="text-[7px] font-bold text-white/40 leading-none">
                  {new Date(ev.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {ev.label && (
                  <span className="text-[6px] font-black text-[var(--soft-gold)] uppercase tracking-tighter leading-none mt-0.5">
                    {ev.label}
                  </span>
                )}
              </div>
              <span className="text-[8px] font-black text-white">
                {symbol}{ev.price.toLocaleString()}
              </span>
            </div>
          ))}
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
          <h2 className="text-lg font-black text-white mb-1">
            Rate Intelligence Grid
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            14-day price comparison vs compset
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-xs font-black uppercase tracking-wider">
            {sortedData.length} Days
          </div>
        </div>
      </div>

      <div className="overflow-x-auto relative rounded-xl border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              {/* Date Column */}
              <th className="sticky left-0 z-20 bg-[var(--deep-ocean)]/95 backdrop-blur-xl p-4 min-w-[140px] border-b border-r border-white/10 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                Date Range
              </th>

              {/* My Hotel Column */}
              <th className="p-4 min-w-[140px] border-b border-white/10 bg-[var(--soft-gold)]/10 border-r border-[var(--soft-gold)]/20 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest">
                    {hotelName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-[9px] font-black uppercase">
                    You
                  </span>
                </div>
              </th>

              {/* Competitor Columns */}
              {effectiveCompetitors.map((comp) => (
                <th
                  key={comp.id}
                  className="p-4 min-w-[140px] border-b border-white/10 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-wider truncate max-w-[120px]">
                      {comp.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
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
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Date Cell */}
                  <td className="sticky left-0 z-10 bg-[var(--deep-ocean)]/95 backdrop-blur-xl p-4 border-r border-white/10 group-hover:bg-[var(--deep-ocean)]">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">
                        {dateObj.toLocaleDateString(
                          locale === "en" ? "en-US" : "tr-TR",
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
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
                    className={`p-4 border-r border-[var(--soft-gold)]/10 text-center relative ${isMyPriceLowest ? "bg-[var(--optimal-green)]/10" : ""}`}
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
                          className={`text-sm font-black ${isMyPriceLowest ? "text-[var(--optimal-green)]" : "text-[var(--soft-gold)]"} ${row.is_estimated_target ? "decoration-dotted underline decoration-white/30" : ""}`}
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
                      <div className="text-[10px] font-black text-white/20 uppercase">
                        N/A
                      </div>
                    )}

                    {/* Best Rate Marker */}
                    {isMyPriceLowest && (
                      <div
                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]"
                        title="Lowest Rate"
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
                        className="p-4 text-center border-b border-white/5 relative group/cell"
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
                                className={`text-sm font-bold ${isCheaper ? "text-[var(--optimal-green)]" : isMoreExpensive ? "text-white" : "text-white/60"} ${isEstimated ? "decoration-dotted underline decoration-white/30" : ""}`}
                              >
                                {symbol}
                                {price.toLocaleString()}
                              </span>
                            </div>
                            {/* Diff Badge */}
                            {diffPercent !== 0 && (
                              <span
                                className={`text-[8px] font-black px-1.5 py-0.5 rounded mt-1 bg-white/5 ${diffPercent > 0 ? "text-[var(--optimal-green)]" : "text-[var(--alert-red)]"}`}
                              >
                                {diffPercent > 0 ? "+" : ""}
                                {diffPercent.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : isVerificationFailed ? (
                          <div className="flex flex-col items-center justify-center opacity-70">
                            <div className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 flex items-center gap-1" title="Price not available for this room type">
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap">
                                N/A
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xl text-white/10">-</span>
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

      <div className="mt-4 flex items-center gap-6 text-[10px] font-bold text-white/40 uppercase tracking-widest pl-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]" />
          Best Market Position
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-[var(--alert-red)]" />
          Above Market Avg
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-3 h-3 text-[var(--optimal-green)]" />
          Below Market Avg
        </div>
      </div>
    </div>
  );
}
