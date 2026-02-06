"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Bell, Crown } from "lucide-react";
import UserMenu from "./UserMenu";
import SubscriptionModal from "@/components/modals/SubscriptionModal";

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
      ? "text-white text-sm font-medium border-b-2 border-[var(--soft-gold)] pb-1"
      : "text-[var(--text-secondary)] text-sm hover:text-white transition-colors";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 relative">
                <Image
                  src="/logo.png"
                  alt="Hotel Rate Sentinel"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-base leading-tight tracking-wide">
                  Hotel Map{" "}
                  <span className="text-[var(--soft-gold)]">Sentinel</span>
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">
                  Rate Intelligence
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className={navLinkClass("/")}>
              {t("common.dashboard")}
            </Link>
            <Link href="/analysis" className={navLinkClass("/analysis")}>
              {t("common.analysis")}
            </Link>
            <Link href="/reports" className={navLinkClass("/reports")}>
              {t("common.reports")}
            </Link>
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Switcher */}
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="text-xs font-bold text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 rounded px-2 py-1 hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] transition-all"
            >
              {locale === "en" ? "TR" : "EN"}
            </button>

            {/* Upgrade Button */}
            {(userProfile?.plan_type === "trial" ||
              !userProfile?.plan_type) && (
              <button
                onClick={handleOpenBilling}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-lg text-amber-200 text-xs font-bold hover:bg-amber-500/30 transition-all"
              >
                <Crown className="w-3 h-3" />
                {t("common.upgrade")}
              </button>
            )}

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            {/* Notifications */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-full transition-all"
              aria-label={t("common.notifications") || "Notifications"}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
            </button>

            {/* User Menu */}
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
              <Link href="/login" className="btn-gold text-xs px-4 py-2">
                {t("common.signIn")}
              </Link>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Language Switcher Mobile */}
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="text-[10px] font-bold text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 rounded px-1.5 py-1 bg-[var(--soft-gold)]/5"
            >
              {locale === "en" ? "TR" : "EN"}
            </button>

            <button
              className="p-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 animate-fade-in bg-[var(--deep-ocean)]">
            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                {t("common.dashboard")}
              </Link>
              <Link
                href="/analysis"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                {t("common.analysis")}
              </Link>
              <Link
                href="/reports"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                {t("common.reports")}
              </Link>
              {userProfile && (
                <div className="pt-4 border-t border-white/10">
                  <UserMenu
                    profile={userProfile}
                    hotelCount={hotelCount || 0}
                    onOpenProfile={onOpenProfile}
                    onOpenSettings={onOpenSettings}
                    onOpenUpgrade={handleOpenBilling}
                    onOpenBilling={handleOpenBilling}
                  />
                </div>
              )}

              {!userProfile && (
                <Link
                  href="/login"
                  className="mt-4 w-full text-center py-3 rounded-xl bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-bold mb-2"
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
