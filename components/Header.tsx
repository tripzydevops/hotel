"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center">
              <span className="text-[var(--deep-ocean)] font-bold text-xl">
                T
              </span>
            </div>
            <span className="text-xl font-bold text-white">
              Tripzy<span className="text-[var(--soft-gold)]">Hotel</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/search"
              className="text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Discover
            </Link>
            <Link
              href="/deals"
              className="text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Deals
            </Link>
            <Link
              href="/favorites"
              className="text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Favorites
            </Link>
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button className="btn-ghost text-sm">Sign In</button>
            <button className="btn-gold text-sm">Get Started</button>
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
          <div className="md:hidden py-4 border-t border-white/10 animate-fade-in">
            <nav className="flex flex-col gap-4">
              <Link
                href="/search"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                Discover
              </Link>
              <Link
                href="/deals"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                Deals
              </Link>
              <Link
                href="/favorites"
                className="text-[var(--text-secondary)] hover:text-white"
              >
                Favorites
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                <button className="btn-ghost text-sm w-full">Sign In</button>
                <button className="btn-gold text-sm w-full">Get Started</button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
