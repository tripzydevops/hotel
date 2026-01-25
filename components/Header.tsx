"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Bell, Crown } from "lucide-react";
import UserMenu from "./UserMenu";
import SubscriptionModal from "./SubscriptionModal";

interface HeaderProps {
  userProfile?: any;
  hotelCount?: number;
  unreadCount?: number;
  onOpenProfile?: () => void;
  onOpenAlerts?: () => void;
  onOpenSettings?: () => void;
  onOpenBilling?: () => void; // Optional: Parent can still override if needed
}

export default function Header({ 
  userProfile, 
  hotelCount = 0, 
  unreadCount = 0,
  onOpenProfile = () => {}, 
  onOpenAlerts = () => {},
  onOpenSettings = () => {},
  onOpenBilling // Optional prop
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false); // We can reuse this or rename to isBillingOpen
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();

  // Prefer internal handler if prop not provided
  const handleOpenBilling = onOpenBilling || (() => setIsBillingOpen(true));

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */ }
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-auto">
              <img 
                src="/logo.png" 
                alt="Hotel Plus Logo" 
                className="h-full w-auto object-contain"
              />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-bold text-[var(--navy-primary)] tracking-tight leading-none">
                Hotel Plus
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--gold-dark)] font-bold">
                    Rate Sentinel
                </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-[var(--navy-primary)] text-sm font-semibold border-b-2 border-[var(--gold-primary)] pb-1"
            >
              {t("common.dashboard")}
            </Link>
            <Link
              href="/analysis"
              className="text-slate-500 text-sm hover:text-[var(--navy-primary)] transition-colors font-medium"
            >
              {t("common.analysis")}
            </Link>
            <Link
              href="/reports"
              className="text-slate-500 text-sm hover:text-[var(--navy-primary)] transition-colors font-medium"
            >
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

            {/* Upgrade Button (Mobile hidden) */}
            {(userProfile?.plan_type === 'trial' || !userProfile?.plan_type) && (
                 <button 
                    onClick={handleOpenBilling}
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-lg text-amber-200 text-xs font-bold hover:bg-amber-500/30 transition-all"
                 >
                    <Crown className="w-3 h-3" />
                    Upgrade
                 </button>
            )}

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            {/* Notifications */}
            <button 
                onClick={onOpenAlerts}
                className="relative p-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 rounded-full transition-all"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                )}
            </button>

            {/* User Menu */}
            <UserMenu 
                profile={userProfile} 
                hotelCount={hotelCount || 0}
                onOpenProfile={onOpenProfile} 
                onOpenSettings={onOpenSettings}
                onOpenUpgrade={handleOpenBilling} 
                onOpenBilling={handleOpenBilling}
            />
            {userProfile ? null : (
                <Link href="/login" className="btn-gold text-xs px-4 py-2">Sign In</Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-[var(--navy-primary)] hover:bg-slate-100 rounded-lg"
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

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10 animate-fade-in bg-[var(--deep-ocean)]">
            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/analysis"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                Analysis
              </Link>
              <Link
                href="/reports"
                 className="text-[var(--text-secondary)] hover:text-white"
              >
                Reports
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
            </nav>
          </div>
        )}
      </div>

      <SubscriptionModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
        currentPlan={userProfile?.plan_type || "trial"}
        onUpgrade={async () => {
             // Mock upgrade in header context - usually would need refresh
             setIsBillingOpen(false);
             window.location.reload(); // Simple way to refresh state for now
        }}
      />
    </header>
  );
}
