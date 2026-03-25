/**
 * EXPLANATION: Landing Page Navbar
 * 
 * A transparent, floating navbar for the marketing pages.
 * Uses glassmorphism effect that becomes solid on scroll.
 * Contains the Hotel Plus logo, navigation links, and the
 * "Oturum Aç" (Login) button that bridges to the dashboard.
 * 
 * Design tokens: Uses the same --deep-ocean and --soft-gold
 * palette as the dashboard for brand consistency.
 */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";

export default function LandingNavbar() {
  /* Track scroll position to toggle solid background */
  const [scrolled, setScrolled] = useState(false);
  /* Mobile menu toggle */
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { href: "/", label: t("landing.nav.home") },
    { href: "/about", label: t("landing.nav.about") },
    { href: "/pricing", label: t("landing.nav.pricing") },
    { href: "/contact", label: t("landing.nav.contact") },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
          ? "bg-[var(--deep-ocean)]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl"
          : "bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <HotelPlusLogo variant="navbar" showDomain />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 relative group cursor-pointer"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[var(--soft-gold)] group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </div>

          {/* Switchers & CTA Buttons */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="glass rounded-full p-1 border border-white/10 flex gap-1">
                <button
                  onClick={() => setLocale("tr")}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${locale === "tr" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  TR
                </button>
                <button
                  onClick={() => setLocale("en")}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${locale === "en" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  EN
                </button>
              </div>
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-[var(--soft-gold)] hover:scale-110 transition-all"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/contact"
                className="btn-ghost text-xs py-2 px-4 cursor-pointer"
              >
                {t("landing.nav.demo")}
              </Link>
              <Link
                href="/login"
                className="btn-gold text-xs py-2 px-5 cursor-pointer"
              >
                {t("landing.common.login")}
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-2 cursor-pointer"
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-6 space-y-3 animate-fade-in">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-[var(--text-secondary)] hover:text-white py-2 cursor-pointer"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center px-2 py-2">
                <div className="flex glass rounded-full p-1 border border-white/10 gap-1">
                  <button
                    onClick={() => setLocale("tr")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${locale === "tr" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-[var(--text-secondary)]"
                      }`}
                  >
                    TR
                  </button>
                  <button
                    onClick={() => setLocale("en")}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${locale === "en" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-[var(--text-secondary)]"
                      }`}
                  >
                    EN
                  </button>
                </div>
                <button
                  onClick={toggleTheme}
                  className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center text-[var(--soft-gold)]"
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
              <Link href="/contact" className="block btn-ghost text-sm text-center py-2.5 cursor-pointer">
                {t("landing.nav.demo")}
              </Link>
              <Link href="/login" className="block btn-gold text-sm text-center py-2.5 cursor-pointer">
                {t("landing.common.login")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
