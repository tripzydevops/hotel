"use client";

import {
  X,
  Check,
  Shield,
  Zap,
  Building2,
  Crown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string; // "trial", "starter", "pro", "enterprise"
  onUpgrade: (plan: string) => Promise<void>;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentPlan = "trial",
  onUpgrade,
}: SubscriptionModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);

  const PLANS = [
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      period: "/mo",
      description: "For small hotels getting started",
      features: [
        "Track up to 5 properties",
        "Daily rate updates",
        "Basic email alerts",
        "7-day history retention",
      ],
      limit: 5,
      icon: Building2,
    },
    {
      id: "pro",
      name: "Professional",
      price: "$79",
      period: "/mo",
      description: "For serious revenue managers",
      popular: true,
      features: [
        "Track up to 25 properties",
        "Hourly rate updates",
        "Instant price drop alerts",
        "Unlimited history",
        "Excel/CSV Exports",
      ],
      limit: 25,
      icon: Zap,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For chains and large groups",
      features: [
        "Unlimited properties",
        "Real-time API Access",
        "Dedicated account manager",
        "Custom implementation",
        "Whitelabel reports",
      ],
      limit: 999,
      icon: Crown,
    },
  ];

  if (!isOpen) return null;

  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(planId);
      await onUpgrade(planId);
    } catch (e) {
      console.error("Upgrade failed", e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500 overflow-y-auto">
      <div className="premium-card w-full max-w-4xl p-10 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10 my-8">
        {/* Silk Glow Aura */}
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-[var(--gold-glow)] opacity-20 blur-[150px] pointer-events-none" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-[var(--gold-glow)] opacity-10 blur-[150px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter uppercase">
              <Shield className="w-8 h-8 text-[var(--gold-primary)]" />
              {t("subscription.title")}
            </h2>
            <p className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-2 opacity-80">
              {t("subscription.subtitle").replace(
                "{0}",
                currentPlan.toUpperCase(),
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all group"
          >
            <X className="w-6 h-6 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = plan.popular;
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 border transition-all duration-500 flex flex-col group/plan ${
                  isPopular
                    ? "bg-black/60 border-[var(--gold-primary)]/40 shadow-[0_0_50px_rgba(212,175,55,0.1)] scale-105 z-10"
                    : "bg-white/5 border-white/5 hover:border-white/10"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--gold-gradient)] text-black text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-xl">
                    <Sparkles className="w-3 h-3 inline mr-1 mb-0.5" />
                    {t("subscription.mostPopular")}
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl w-fit mb-6 transition-transform duration-500 group-hover/plan:scale-110 ${isPopular ? "bg-[var(--gold-primary)]/10" : "bg-white/5"}`}
                >
                  <Icon
                    className={`w-8 h-8 ${isPopular ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
                  />
                </div>

                <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white tracking-tighter">
                    {plan.price}
                  </span>
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                    {plan.period}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] mb-8 h-10 leading-relaxed uppercase tracking-wider">
                  {plan.description}
                </p>

                <div className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className={`mt-1 p-0.5 rounded-full ${isPopular ? "bg-[var(--gold-primary)]/20" : "bg-white/10"}`}
                      >
                        <Check
                          className={`w-3 h-3 shrink-0 ${isPopular ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
                        />
                      </div>
                      <span className="text-xs font-bold text-white/80 tracking-tight leading-snug">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || loading !== null}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? "bg-white/5 text-[var(--text-muted)] cursor-default border border-white/5"
                      : isPopular
                        ? "btn-premium shadow-xl shadow-[var(--gold-glow)]"
                        : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                  }`}
                >
                  {loading === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    t("subscription.currentPlan")
                  ) : (
                    <>
                      <Zap
                        className={`w-4 h-4 ${isPopular ? "text-black" : "text-[var(--gold-primary)]"}`}
                      />
                      {t("subscription.upgrade")}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
          {t("subscription.contactSales")}
        </div>
      </div>
    </div>
  );
}
