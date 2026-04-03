"use client";

import { X, Check, Shield, Zap, Building2, Crown, Loader2 } from "lucide-react";
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
      name: t("subscription.starter.name"),
      price: t("subscription.price.starter"),
      period: t("subscription.period.mo"),
      description: t("subscription.starter.description"),
      features: [
        t("subscription.starter.features.0"),
        t("subscription.starter.features.1"),
        t("subscription.starter.features.2"),
        t("subscription.starter.features.3"),
        t("subscription.starter.features.4"),
      ],
      limit: 5,
      icon: Building2,
    },
    {
      id: "pro",
      name: t("subscription.pro.name"),
      price: t("subscription.price.pro"),
      period: t("subscription.period.mo"),
      description: t("subscription.pro.description"),
      popular: true,
      features: [
        t("subscription.pro.features.0"),
        t("subscription.pro.features.1"),
        t("subscription.pro.features.2"),
        t("subscription.pro.features.3"),
        t("subscription.pro.features.4"),
        t("subscription.pro.features.5"),
      ],
      limit: 25,
      icon: Zap,
    },
    {
      id: "enterprise",
      name: t("subscription.enterprise.name"),
      price: t("subscription.price.enterprise"),
      period: t("subscription.period.custom"),
      description: t("subscription.enterprise.description"),
      features: [
        t("subscription.enterprise.features.0"),
        t("subscription.enterprise.features.1"),
        t("subscription.enterprise.features.2"),
        t("subscription.enterprise.features.3"),
        t("subscription.enterprise.features.4"),
        t("subscription.enterprise.features.5"),
      ],
      limit: 100,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-5xl shadow-2xl border border-[var(--soft-gold)]/20 my-8">
        {/* Tactical Header */}
        <div className="p-8 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--soft-gold)]/5 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
              <Shield className="w-6 h-6 text-[var(--soft-gold)]" />
              {t("subscription.title")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse shadow-[0_0_8px_var(--soft-gold)]" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] font-black">
                {t("subscription.subtitle").replace("{0}", currentPlan.toUpperCase())}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--glass-bg-accent)] rounded-xl transition-all hover:rotate-90 group border border-transparent hover:border-[var(--glass-border)]"
          >
            <X className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
          </button>
        </div>

        <div className="p-8">
          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isPopular = plan.popular;
              const Icon = plan.icon;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-8 border transition-all duration-500 flex flex-col group/card ${
                    isPopular
                      ? "bg-[var(--soft-gold)]/10 border-[var(--soft-gold)] shadow-[0_0_40px_rgba(212,175,55,0.1)] scale-105 z-10 h-full"
                      : "bg-[var(--glass-bg-accent)] border-[var(--glass-border)] hover:border-[var(--soft-gold)]/30 hover:bg-[var(--soft-gold)]/5 h-full"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-[0_0_15px_var(--soft-gold)] whitespace-nowrap">
                      {t("subscription.mostPopular")}
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl w-fit mb-6 transition-transform group-hover/card:scale-110 duration-500 ${
                    isPopular ? "bg-[var(--soft-gold)]/20" : "bg-[var(--glass-bg)] border border-[var(--glass-border)]"
                  }`}>
                    <Icon
                      className={`w-8 h-8 ${isPopular ? "text-[var(--soft-gold)]" : "text-[var(--text-primary)]"}`}
                    />
                  </div>

                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2 tracking-tight group-hover/card:text-[var(--soft-gold)] transition-colors">
                    {plan.name}
                  </h3>
                  
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">
                      {plan.price}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">
                      / {plan.period}
                    </span>
                  </div>
                  
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-8 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="space-y-4 mb-10 flex-1">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 group/feature"
                      >
                        <div className={`mt-0.5 p-0.5 rounded-full ${isPopular ? "bg-[var(--soft-gold)]/20" : "bg-[var(--glass-border)]"}`}>
                          <Check className={`w-3 h-3 ${isPopular ? "text-[var(--soft-gold)]" : "text-[var(--text-primary)]"}`} />
                        </div>
                        <span className="text-xs font-semibold text-[var(--text-secondary)] leading-snug group-hover/feature:text-[var(--text-primary)] transition-colors">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || loading !== null}
                    className={`w-full py-4 px-6 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                      isCurrent
                        ? "bg-[var(--glass-border)] text-[var(--text-muted)] cursor-default border border-transparent"
                        : isPopular
                        ? "btn-premium shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                        : "bg-[var(--text-primary)] text-[var(--deep-ocean)] hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] active:scale-95"
                    }`}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCurrent ? (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>{t("subscription.currentPlan")}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>{t("subscription.upgrade")}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block px-6 py-3 rounded-2xl bg-[var(--soft-gold)]/5 border border-[var(--glass-border)]">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.25em] font-black">
                {t("subscription.contactSales")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
