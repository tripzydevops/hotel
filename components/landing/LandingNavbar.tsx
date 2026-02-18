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

  const navLinks = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/about", label: "Hakkımızda" },
    { href: "/pricing", label: "Fiyatlandırma" },
    { href: "/contact", label: "İletişim" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#050e1b]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            {/* EXPLANATION: Inline SVG logo icon matching the login page design */}
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--soft-gold)]/20 blur-xl group-hover:blur-2xl transition-all duration-500 rounded-full" />
              <div className="relative bg-gradient-to-br from-[#bf953f] via-[#fcf6ba] to-[#aa771c] p-[1.5px] rounded-xl">
                <div className="bg-[#050B18] rounded-[10px] flex items-center justify-center h-10 w-10 p-1">
                  <div className="relative w-6 h-6">
                    <div className="absolute left-0 top-0 w-1.5 h-full bg-[#003366] rounded-sm"></div>
                    <div className="absolute right-0 top-0 w-1.5 h-full bg-[#003366] rounded-sm"></div>
                    <div className="absolute left-0 top-[42%] w-full h-1 bg-[#003366]"></div>
                    <div className="absolute left-[20%] bottom-0 flex items-end gap-[1px]">
                      <div className="w-1 h-1.5 bg-[#F6C344]"></div>
                      <div className="w-1 h-2.5 bg-[#F6C344]"></div>
                      <div className="w-1 h-3.5 bg-[#F6C344]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">
                Hotel <span className="text-[var(--soft-gold)]">Plus</span>
              </span>
              <p className="text-[8px] text-[#F6C344]/60 uppercase tracking-[0.3em] font-bold -mt-0.5">
                Rate Sentinel
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors duration-200 relative group cursor-pointer"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[var(--soft-gold)] group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/contact"
              className="btn-ghost text-sm py-2.5 px-5 cursor-pointer"
            >
              Demo Talebi
            </Link>
            <Link
              href="/login"
              className="btn-gold text-sm py-2.5 px-6 cursor-pointer"
            >
              Oturum Aç
            </Link>
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
              <Link href="/contact" className="block btn-ghost text-sm text-center py-2.5 cursor-pointer">
                Demo Talebi
              </Link>
              <Link href="/login" className="block btn-gold text-sm text-center py-2.5 cursor-pointer">
                Oturum Aç
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
