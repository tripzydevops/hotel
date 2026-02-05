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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card w-full max-w-4xl p-6 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-[var(--soft-gold)]" />
              {t("subscription.title")}
            </h2>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {t("subscription.subtitle").replace(
                "{0}",
                currentPlan.toUpperCase(),
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = plan.popular;
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 border transition-all duration-300 md:hover:-translate-y-1 md:hover:shadow-2xl md:hover:shadow-[var(--soft-gold)]/10 flex flex-col ${
                  isPopular
                    ? "bg-gradient-to-b from-white/10 to-transparent border-[var(--soft-gold)]"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--soft-gold)] text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    {t("subscription.mostPopular")}
                  </div>
                )}

                <div className="p-3 bg-white/5 rounded-xl w-fit mb-4">
                  <Icon
                    className={`w-6 h-6 ${isPopular ? "text-[var(--soft-gold)]" : "text-white"}`}
                  />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-white">
                    {plan.price}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-6 h-10">
                  {plan.description}
                </p>

                <div className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-sm text-[var(--text-secondary)]"
                    >
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${isPopular ? "text-[var(--soft-gold)]" : "text-white/50"}`}
                      />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || loading !== null}
                  className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? "bg-white/10 text-white cursor-default"
                      : isPopular
                        ? "btn-gold shadow-lg shadow-[var(--soft-gold)]/20 hover:scale-[1.02]"
                        : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {loading === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    t("subscription.currentPlan")
                  ) : (
                    t("subscription.upgrade")
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center text-xs text-[var(--text-muted)]">
          {t("subscription.contactSales")}
        </div>
      </div>
    </div>
  );
}
