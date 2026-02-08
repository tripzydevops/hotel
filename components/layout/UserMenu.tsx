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
        className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] p-[1px]">
          <div className="w-full h-full rounded-full bg-[var(--deep-ocean)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--soft-gold)]">
              {profile?.display_name?.substring(0, 2).toUpperCase() || "ME"}
            </span>
          </div>
        </div>
        <div className="text-left hidden md:block">
          <p className="text-xs text-white font-medium leading-none mb-0.5">
            {profile?.display_name || "User"}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] leading-none uppercase tracking-wider">
            {plan}
          </p>
        </div>
        <ChevronDown
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#050B18] border border-white/10 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 origin-top-right z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              {profile?.display_name || "Guest User"}
              {profile?.plan_type === "enterprise" &&
                profile?.display_name === "Demo User" && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase">
                    Dev
                  </span>
                )}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {profile?.email || "No email"}
            </p>
          </div>

          {/* Membership Card */}
          <div className="p-3">
            <div
              className={`rounded-lg p-3 border ${isPro ? "bg-gradient-to-br from-[var(--soft-gold)]/10 to-transparent border-[var(--soft-gold)]/20" : "bg-white/5 border-white/5"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <Sparkles className="w-3 h-3 text-[var(--soft-gold)]" />
                  ) : (
                    <User className="w-3 h-3 text-[var(--text-muted)]" />
                  )}
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${isPro ? "text-[var(--soft-gold)]" : "text-white"}`}
                  >
                    {plan.toUpperCase()} {t("userMenu.planSuffix")}
                  </span>
                </div>
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-[var(--optimal-green)]">
                  {t("userMenu.planActive")}
                </span>
              </div>

              {/* Usage Bar */}
              <div className="mb-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>{t("userMenu.hotelsTracked")}</span>
                <span>
                  {hotelCount} / {limit}
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isPro ? "bg-[var(--soft-gold)]" : "bg-white/40"}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {!isPro && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenUpgrade?.();
                  }}
                  className="w-full mt-3 py-1.5 text-xs bg-[var(--soft-gold)] text-black font-bold rounded hover:opacity-90 transition-opacity"
                >
                  {t("userMenu.upgradeToPro")}
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5 my-1" />

          {/* Actions */}
          <div className="px-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenProfile?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <User className="w-4 h-4" />
              {t("userMenu.myProfile")}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenSettings?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <Settings className="w-4 h-4" />
              {t("userMenu.alertSettings")}
            </button>
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Shield className="w-4 h-4" />
              {t("userMenu.adminPanel")}
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenBilling?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <CreditCard className="w-4 h-4" />
              {t("userMenu.billing")}
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              {t("userMenu.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
