"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Bell, Crown, Zap, Globe, User } from "lucide-react";
import UserMenu from "./UserMenu";
import SubscriptionModal from "./SubscriptionModal";

interface HeaderProps {
  userProfile?: any;
  hotelCount?: number;
  unreadCount?: number;
  onOpenProfile?: () => void;
  onOpenAlerts?: () => void;
  onOpenSettings?: () => void;
  onOpenBilling?: () => void;
}

export default function Header({
  userProfile,
  hotelCount = 0,
  unreadCount = 0,
  onOpenProfile = () => {},
  onOpenAlerts = () => {},
  onOpenSettings = () => {},
  onOpenBilling,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();

  const handleOpenBilling = onOpenBilling || (() => setIsBillingOpen(true));

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/" || pathname === "";
    return pathname.startsWith(path);
  };

  const navLinkClass = (path: string) =>
    isActive(path)
      ? "text-white text-[10px] font-black uppercase tracking-[0.2em] relative after:absolute after:bottom-[-20px] after:left-0 after:right-0 after:h-[2px] after:bg-[var(--gold-gradient)]"
      : "text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-all transform hover:translate-y-[-1px]";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-3xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo Identity */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="relative w-10 h-10 transition-transform duration-500 group-hover:scale-110">
              <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-xl rounded-full" />
              <img
                src="/logo.png"
                alt="Hotel Plus Logo"
                className="relative h-full w-full object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-white tracking-widest leading-none uppercase italic">
                Nexus
              </span>
              <span className="text-[9px] uppercase tracking-[0.4em] text-[var(--gold-primary)] font-black opacity-80">
                Rate_Sentinel
              </span>
            </div>
          </Link>

          {/* Core Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {[
              { path: "/", label: t("common.dashboard") },
              { path: "/analysis", label: t("common.analysis") },
              { path: "/reports", label: t("common.reports") },
            ].map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={navLinkClass(link.path)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Action Protocol Section */}
          <div className="hidden md:flex items-center gap-6">
            {/* Language Selection */}
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="flex items-center gap-2 text-[10px] font-black text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 rounded-xl px-4 py-2 hover:bg-[var(--gold-primary)] hover:text-black transition-all group overflow-hidden relative"
            >
              <Globe className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">
                {locale === "en" ? "TR" : "EN"}
              </span>
            </button>

            {/* Premium Upgrade Protocol */}
            {(userProfile?.plan_type === "trial" ||
              !userProfile?.plan_type) && (
              <button
                onClick={handleOpenBilling}
                className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-2xl text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] hover:from-amber-500/20 hover:to-amber-600/20 transition-all shadow-[0_0_20px_rgba(245,158,11,0.05)] group"
              >
                <Crown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>{t("common.upgrade")}</span>
              </button>
            )}

            <div className="h-8 w-px bg-white/5 opacity-40 mx-2" />

            {/* Neural Notifications */}
            <button
              onClick={onOpenAlerts}
              className="relative p-3 rounded-2xl bg-white/5 border border-white/5 text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-white/10 transition-all group"
            >
              <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              {unreadCount > 0 && (
                <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(239,68,68,1)] border-2 border-black" />
              )}
            </button>

            {/* Identity Persistence */}
            {userProfile && (
              <UserMenu
                profile={userProfile}
                hotelCount={hotelCount || 0}
                onOpenProfile={onOpenProfile}
                onOpenSettings={onOpenSettings}
                onOpenUpgrade={handleOpenBilling}
                onOpenBilling={handleOpenBilling}
              />
            )}
            {!userProfile && (
              <Link
                href="/login"
                className="btn-premium px-8 py-3.5 text-[10px] font-black uppercase tracking-[0.2em]"
              >
                {t("common.signIn")}
              </Link>
            )}
          </div>

          {/* Mobile Access Protocol */}
          <div className="flex lg:hidden items-center gap-4">
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="p-2.5 rounded-xl border border-[var(--gold-primary)]/20 text-[var(--gold-primary)] bg-[var(--gold-primary)]/5"
            >
              <Globe className="w-5 h-5" />
            </button>

            <button
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between items-end relative overflow-hidden">
                <span
                  className={`h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? "w-6 rotate-45 translate-y-2" : "w-6"}`}
                />
                <span
                  className={`h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? "opacity-0" : "w-4"}`}
                />
                <span
                  className={`h-0.5 bg-[var(--gold-primary)] transition-all duration-300 ${isMenuOpen ? "w-6 -rotate-45 -translate-y-2.5" : "w-5"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Persistence */}
        {isMenuOpen && (
          <div className="lg:hidden py-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500 bg-black/90 backdrop-blur-3xl absolute top-full left-0 right-0 h-screen">
            <nav className="flex flex-col gap-8 px-10">
              {[
                { path: "/", label: t("common.dashboard") },
                { path: "/analysis", label: t("common.analysis") },
                { path: "/reports", label: t("common.reports") },
              ].map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`text-xl font-black uppercase tracking-[0.3em] ${isActive(link.path) ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="h-px bg-white/5 w-full my-4" />

              {userProfile && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <User className="w-8 h-8 text-[var(--gold-primary)]" />
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white uppercase">
                        {userProfile.display_name}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {userProfile.plan_type}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onOpenAlerts}
                    className="flex items-center gap-4 text-[var(--text-muted)] uppercase font-black tracking-widest text-sm"
                  >
                    <Bell className="w-5 h-5" /> {t("alerts.title")}
                  </button>
                </div>
              )}

              {!userProfile && (
                <Link
                  href="/login"
                  className="w-full py-5 rounded-2xl bg-[var(--gold-gradient)] text-black font-black uppercase tracking-[0.3em] text-center shadow-2xl"
                >
                  {t("common.signIn")}
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>

      <SubscriptionModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
        currentPlan={userProfile?.plan_type || "trial"}
        onUpgrade={async () => {
          setIsBillingOpen(false);
          window.location.reload();
        }}
      />
    </header>
  );
}
