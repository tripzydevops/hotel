"use client";

import React, { useState } from "react";
import { ArrowRight, X, AlertTriangle, Wand2, Copy, Check, Loader2 } from "lucide-react";
import { HotelWithPrice } from "@/types";
import { api } from "@/lib/api";
import { parsePrice, normalizeVendor } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ViolatingChannelsProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

export default function ViolatingChannels({
  targetHotel,
  competitors = [],
}: ViolatingChannelsProps) {
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [disputeLetter, setDisputeLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const targetOffers = targetHotel?.price_info?.offers || [];
  const targetDirectOffer = targetOffers.find((o) => o.is_direct);
  const targetPrice = targetDirectOffer ? parsePrice(targetDirectOffer.price || 0) : parsePrice(targetHotel?.price_info?.current_price || 0);
  const hotelId = targetHotel?.id || "";

  // Filter real violations
  const violations = competitors
    .filter(
      (c) =>
        c.price_info?.current_price && parsePrice(c.price_info.current_price) < targetPrice,
    )
    .map((c) => {
      const price = parsePrice(c.price_info!.current_price);
      const diffPercent = ((targetPrice - price) / targetPrice) * 100;
      return {
        id: c.id,
        name: c.name,
        vendor: normalizeVendor(c.price_info?.vendor || c.price_info?.source || "Other"),
        current_price: price,
        target_price: targetPrice,
        currency: c.price_info?.currency || "TRY",
        diff: `-${Number(diffPercent).toFixed(1)}%`,
        severity: diffPercent > 5 ? "high" : "low",
        desc: `Undercut detected at ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: c.price_info?.currency || "TRY" }).format(price)}.`,
        last: "Just Now",
      };
    });

  const handleGenerateDispute = async (v: any) => {
    setSelectedViolation(v);
    setIsGenerating(true);
    setDisputeLetter("");
    setCopied(false);

    try {
      const res = await api.generateDispute({
        hotel_id: hotelId,
        ota_name: v.vendor, // Use normalized vendor name for dispute
        current_price: v.current_price,
        target_price: v.target_price,
        currency: v.currency,
        language: "tr", // Default to Turkish
      });
      setDisputeLetter(res.letter);
    } catch (error) {
      console.error("Failed to generate dispute:", error);
      setDisputeLetter("Failed to generate dispute letter. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(disputeLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card-blur rounded-[2.5rem] p-8 h-full bg-white dark:bg-gradient-to-b dark:from-[#0A1629]/80 dark:to-[#050B18] border border-slate-200 dark:border-[var(--overlay-border)] shadow-2xl relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-black text-[var(--overlay-text)] uppercase tracking-widest">Revenue Recovery</h2>
        {violations.length > 0 && (
          <span className="text-[10px] bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/20 font-black uppercase tracking-widest animate-pulse">
            {violations.length} Leakage Alerts
          </span>
        )}
      </div>

      <div className="space-y-6">
        {violations.length > 0 ? (
          violations.map((v, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-[1.5rem] bg-slate-50/50 dark:bg-[#050B18]/50 border-2 relative overflow-hidden group transition-all ${
                v.severity === "high"
                  ? "border-rose-500/20 hover:border-rose-500/50"
                  : "border-yellow-500/20 hover:border-yellow-500/50"
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${v.severity === "high" ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"}`}
              ></div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-black text-[var(--overlay-text)] text-md tracking-tight truncate">
                    {v.name}
                  </h4>
                  <div className="text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-widest mt-0.5">
                    {v.vendor}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-black text-lg ${v.severity === "high" ? "text-rose-500" : "text-yellow-600 dark:text-yellow-500"}`}>
                    {v.diff}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-tighter">Market Gap</span>
                </div>
              </div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-4">{v.desc}</p>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--overlay-border)]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live Sync
                </span>
                <button 
                  onClick={() => handleGenerateDispute(v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[var(--overlay-text)] text-[11px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95 group/btn"
                >
                  <Wand2 className="w-3.5 h-3.5 group-hover/btn:rotate-12 transition-transform" />
                  Generate Dispute
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
              <AlertTriangle className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-lg font-black text-[var(--overlay-text)] uppercase tracking-widest">Shield Secure</p>
            <p className="text-sm text-slate-500 mt-2 max-w-[200px] leading-relaxed">
              No pricing leakage detected across tracked channels.
            </p>
          </div>
        )}
      </div>

      {/* AI Dispute Modal */}
      <AnimatePresence>
        {selectedViolation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#0A1629] border border-slate-200 dark:border-[var(--overlay-border)] rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-[var(--overlay-border)] flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl">
                    <Wand2 className="w-6 h-6 text-[var(--overlay-text)]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--overlay-text)] tracking-tight">AI Dispute Generator</h3>
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">
                      Resolving: {selectedViolation.name}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedViolation(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="p-8">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] animate-pulse">
                      Synthesizing Dispute Logic...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-50 dark:bg-[#050B18] border border-slate-200 dark:border-[var(--overlay-border)] rounded-2xl p-6 mb-8 max-h-[400px] overflow-y-auto scrollbar-hide">
                      <pre className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap font-sans">
                        {disputeLetter}
                      </pre>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 max-w-[300px] font-medium italic">
                        Guideline: Review and customize this text before sending to your OTA Market Manager.
                      </p>
                      <div className="flex gap-3">
                        <button 
                          onClick={handleCopy}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-[var(--overlay-text)] text-xs font-black uppercase tracking-widest transition-all"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copied" : "Copy to Clipboard"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-10">
        <div className="p-5 bg-gradient-to-br from-blue-600/5 to-transparent rounded-2xl border border-blue-500/10">
          <h5 className="text-[11px] font-black text-[#F6C344] uppercase tracking-[0.2em] mb-3">
            Recovery Intelligence
          </h5>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 dark:text-slate-500 font-bold uppercase tracking-tighter">Shield Policy</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                Active protection
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 dark:text-slate-500 font-bold uppercase tracking-tighter">Auto-Dispute</span>
              <span className="font-black text-slate-900 dark:text-[var(--overlay-text)] uppercase tracking-widest">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
