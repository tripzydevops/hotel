"use client";

import { useState, useRef, useEffect } from "react";
import {
  User,
  LogOut,
  Shield,
  CreditCard,
  ChevronDown,
  Sparkles,
  Settings,
  Zap,
  Globe,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface UserMenuProps {
  profile: any; // Ideally typed
  hotelCount: number;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenUpgrade?: () => void;
  onOpenBilling?: () => void;
}

export default function UserMenu({
  profile,
  hotelCount,
  onOpenProfile,
  onOpenSettings,
  onOpenUpgrade,
  onOpenBilling,
}: UserMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute Limits
  const getLimit = (plan: string) => {
    switch (plan) {
      case "trial":
        return 3;
      case "starter":
        return 10;
      case "pro":
        return 50;
      case "enterprise":
        return 100;
      default:
        return 3;
    }
  };

  const plan = profile?.plan_type || "trial";
  const limit = getLimit(plan);
  const usagePercent = Math.min((hotelCount / limit) * 100, 100);
  const isPro = plan === "pro" || plan === "enterprise";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 pr-4 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group relative overflow-hidden"
      >
        <div className="relative w-9 h-9">
          <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-md rounded-full group-hover:blur-lg transition-all" />
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[var(--gold-primary)] to-[#8c6d00] p-[2px] shadow-lg">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
              <span className="text-xs font-black text-[var(--gold-primary)] uppercase tracking-tighter">
                {profile?.display_name?.substring(0, 2).toUpperCase() || "ID"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-left hidden md:block">
          <p className="text-xs text-white font-black uppercase tracking-tight leading-none mb-1">
            {profile?.display_name || "Nexus_User"}
          </p>
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <div
              className={`w-1 h-1 rounded-full ${isPro ? "bg-[var(--gold-primary)] animate-pulse" : "bg-white"}`}
            />
            <p
              className={`text-[9px] font-black leading-none uppercase tracking-[0.2em] ${isPro ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
            >
              {plan}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-white transition-all duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 bg-[var(--bg-deep)]/95 backdrop-blur-3xl border border-[var(--card-border)] rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] py-3 animate-in fade-in slide-in-from-top-4 origin-top-right z-50">
          {/* Internal Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--gold-glow)] opacity-10 blur-3xl pointer-events-none" />

          {/* User Profile Header */}
          <div className="px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                <User className="w-6 h-6 text-[var(--gold-primary)]" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-black text-white truncate uppercase tracking-tight">
                  {profile?.display_name || "Guest_Protocol"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="w-3 h-3 text-[var(--text-muted)]" />
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate">
                    {profile?.email || "awaiting@sync.net"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Membership Status Visualization */}
          <div className="p-4">
            <div
              className={`rounded-2xl p-5 border transition-all duration-500 relative overflow-hidden ${
                isPro
                  ? "bg-black/60 border-[var(--gold-primary)]/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]"
                  : "bg-white/[0.03] border-white/5"
              }`}
            >
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg ${isPro ? "bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]" : "bg-white/10 text-white/40"}`}
                  >
                    {isPro ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-[0.2em] ${isPro ? "text-[var(--gold-primary)]" : "text-white/60"}`}
                  >
                    {plan}_Identity
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                    Status_Active
                  </span>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-3 relative z-10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-[var(--text-muted)]">Node_Load</span>
                  <span className="text-white">
                    {hotelCount} <span className="opacity-40">/</span> {limit}
                  </span>
                </div>
                <div className="w-full h-2 bg-black/60 rounded-full border border-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${isPro ? "bg-[var(--gold-gradient)]" : "bg-white/20"}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {!isPro && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenUpgrade?.();
                  }}
                  className="w-full mt-5 py-3 group/btn relative overflow-hidden bg-[var(--gold-gradient)] rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <Zap className="w-3.5 h-3.5 text-black" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
                      {t("userMenu.upgradeToPro")}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5 my-2" />

          {/* Menu Actions */}
          <div className="px-3 py-2 space-y-1">
            {[
              {
                icon: User,
                label: t("userMenu.myProfile"),
                onClick: onOpenProfile,
              },
              {
                icon: Settings,
                label: t("userMenu.alertSettings"),
                onClick: onOpenSettings,
              },
              { icon: Shield, label: t("userMenu.adminPanel"), link: "/admin" },
              {
                icon: CreditCard,
                label: t("userMenu.billing"),
                onClick: onOpenBilling,
              },
            ].map((item, idx) =>
              item.link ? (
                <Link
                  key={idx}
                  href={item.link}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all group/item"
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-4 h-4 group-hover/item:text-[var(--gold-primary)] transition-colors" />
                  {item.label}
                </Link>
              ) : (
                <button
                  key={idx}
                  onClick={() => {
                    setIsOpen(false);
                    item.onClick?.();
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all text-left group/item"
                >
                  <item.icon className="w-4 h-4 group-hover/item:text-[var(--gold-primary)] transition-colors" />
                  {item.label}
                </button>
              ),
            )}

            <div className="h-px bg-white/5 my-2" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all text-left group/out"
            >
              <LogOut className="w-4 h-4 group-hover/out:translate-x-1 transition-transform" />
              {t("userMenu.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
