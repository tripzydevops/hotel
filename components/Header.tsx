"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Bell } from "lucide-react";
import UserMenu from "./UserMenu";

interface HeaderProps {
  userProfile?: any;
  hotelCount?: number;
  unreadCount?: number;
  onOpenProfile?: () => void;
  onOpenAlerts?: () => void;
  onOpenSettings?: () => void;
}

export default function Header({ 
  userProfile, 
  hotelCount = 0, 
  unreadCount = 0,
  onOpenProfile, 
  onOpenAlerts,
  onOpenSettings 
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Hotel Plus" className="h-16 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-white text-sm font-medium border-b-2 border-[var(--soft-gold)] pb-1"
            >
              {t("common.dashboard")}
            </Link>
            <Link
              href="/analysis"
              className="text-[var(--text-secondary)] text-sm hover:text-white transition-colors"
            >
              {t("common.analysis")}
            </Link>
            <Link
              href="/reports"
              className="text-[var(--text-secondary)] text-sm hover:text-white transition-colors"
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

            {/* Notifications */}
            <button 
              onClick={onOpenAlerts}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors group"
            >
              <Bell className="w-5 h-5 text-[var(--soft-gold)] group-hover:text-white transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
              )}
            </button>

            {userProfile ? (
                 <UserMenu 
                    profile={userProfile} 
                    hotelCount={hotelCount} 
                    onOpenProfile={onOpenProfile || (() => {})} 
                    onOpenSettings={onOpenSettings || (() => {})}
                 />
            ) : (
                <Link href="/login" className="btn-gold text-xs px-4 py-2">Sign In</Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-white"
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
                           hotelCount={hotelCount} 
                           onOpenProfile={onOpenProfile || (() => {})} 
                           onOpenSettings={onOpenSettings || (() => {})}
                       />
                   </div>
               )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
