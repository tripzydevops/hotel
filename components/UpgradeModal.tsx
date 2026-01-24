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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--deep-ocean-card)] border border-[var(--soft-gold)]/20 rounded-2xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 p-6 md:p-8">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--soft-gold)]/10 flex items-center justify-center mx-auto mb-4 border border-[var(--soft-gold)]/20">
             <span className="text-2xl">🚀</span>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-[var(--text-secondary)] bg-clip-text text-transparent">
            Upgrade to Pro
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            Unlock the full power of Hotel Rate Sentinel
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {[
            "Unlimited Hotels Tracked",
            "Daily Automatic Scans",
            "Historical Trends & Analytics",
            "Competitor Alerting",
            "Priority Support"
          ].map((feature, i) => (
             <div key={i} className="flex items-center gap-3">
                 <div className="w-5 h-5 rounded-full bg-[var(--optimal-green)]/10 flex items-center justify-center">
                     <Check className="w-3 h-3 text-[var(--optimal-green)]" />
                 </div>
                 <span className="text-white text-sm">{feature}</span>
             </div>
          ))}
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5">
             <div className="flex justify-between items-center mb-1">
                 <span className="text-white font-medium">Pro Plan</span>
                 <span className="text-2xl font-bold text-[var(--soft-gold)]">$99<span className="text-xs text-[var(--text-muted)] font-normal">/mo</span></span>
             </div>
             <p className="text-xs text-[var(--text-muted)]">Billed monthly. Cancel anytime.</p>
        </div>

        <button 
            onClick={() => {
                alert("Payment gateway integration pending. Please contact sales@tripzy.travel for manual upgrade.");
                onClose();
            }}
            className="w-full py-3 bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] font-bold rounded-xl hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all transform hover:scale-[1.02]"
        >
            Subscribe Now
        </button>
      </div>
    </div>
  );
}
