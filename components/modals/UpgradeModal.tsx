"use client";

import { useI18n } from "@/lib/i18n";
import { Check, X } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-500 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--soft-gold)]/10 blur-3xl -translate-y-16 translate-x-16 rounded-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--deep-ocean-accent)]/20 blur-3xl translate-y-24 -translate-x-24 rounded-full" />

        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-[var(--glass-bg-accent)]/50 hover:bg-[var(--glass-bg-accent)] rounded-full transition-all hover:rotate-90 group z-10"
        >
          <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
        </button>

        <div className="relative p-8 md:p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--soft-gold)]/20 to-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 shadow-xl shadow-[var(--soft-gold)]/5 relative group">
               <span className="text-3xl filter drop-shadow-lg transform group-hover:scale-110 transition-transform">🚀</span>
               <div className="absolute inset-0 bg-[var(--soft-gold)] blur-md opacity-0 group-hover:opacity-20 transition-opacity rounded-2xl" />
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">
                Elevate to <span className="text-[var(--soft-gold)]">Pro</span>
              </h2>
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-[var(--soft-gold)]/30" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Maximum Intelligence Tier
                </p>
                <span className="h-px w-8 bg-[var(--soft-gold)]/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Unlimited Hotel Monitoring",
              "Real-time Intelligence Scans",
              "Predictive Market Trends",
              "Automated Competitor Alerts",
              "Priority Data Fetching",
              "Executive Reporting Suite"
            ].map((feature, i) => (
               <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--glass-bg-accent)]/30 border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/30 transition-colors group">
                   <div className="mt-0.5 w-5 h-5 rounded-lg bg-[var(--optimal-green)]/10 flex items-center justify-center ring-1 ring-[var(--optimal-green)]/20 group-hover:bg-[var(--optimal-green)]/20 transition-colors shrink-0">
                       <Check className="w-3 h-3 text-[var(--optimal-green)]" />
                   </div>
                   <span className="text-[var(--text-primary)] text-[11px] font-bold leading-tight uppercase tracking-tight">{feature}</span>
               </div>
            ))}
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-[var(--soft-gold)] blur-2xl opacity-5 group-hover:opacity-10 transition-opacity" />
            <div className="relative bg-[var(--glass-bg-accent)]/80 rounded-2xl p-6 border border-[var(--soft-gold)]/20 shadow-inner flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="space-y-1 text-center md:text-left">
                     <span className="inline-block px-3 py-1 bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] text-[10px] font-black uppercase tracking-widest rounded-full border border-[var(--soft-gold)]/20 mb-2">Exclusive Offer</span>
                     <h3 className="text-white text-xl font-black uppercase tracking-tight">Sentinel Pro <span className="text-[var(--text-muted)] font-normal text-sm">Monthly</span></h3>
                     <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest leading-relaxed">Advanced competitive advantage protocols.</p>
                 </div>
                 <div className="text-center md:text-right">
                     <div className="flex items-baseline gap-1 animate-in zoom-in-50 duration-500">
                      <span className="text-sm font-black text-[var(--soft-gold)]">$</span>
                      <span className="text-5xl font-black text-white tracking-tighter">99</span>
                      <span className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">/ Month</span>
                     </div>
                     <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-tighter mt-1 italic">Pause or Cancel anytime</p>
                 </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
                onClick={() => {
                    alert("The secure payment gateway is being provisioned. For immediate activation, contact our executive support team at sales@tripzy.travel");
                    onClose();
                }}
                className="w-full btn-premium py-5 shadow-[0_20px_50px_rgba(212,175,55,0.25)] active:scale-[0.98] relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
                <span className="relative text-sm font-black uppercase tracking-[0.3em]">Initialize Subscription</span>
            </button>
            <p className="text-[9px] text-center text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mt-6 opacity-40">
              Trusted by leading properties globally
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
