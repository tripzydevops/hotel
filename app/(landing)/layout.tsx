/**
 * EXPLANATION: Landing Route Group Layout
 * 
 * This layout wraps ALL public marketing pages (/, /about, /pricing, /contact)
 * with the LandingNavbar and LandingFooter.
 * 
 * Uses a Next.js route group "(landing)" so these pages share the
 * marketing layout without affecting the URL structure.
 * The dashboard pages use a separate "(dashboard)" route group
 * with their own DashboardLayout (sidebar + header).
 */
"use client";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { useTheme } from "@/lib/theme";

export default function LandingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <div className={theme === "light" ? "light-theme" : ""}>
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:p-4 focus:bg-[var(--soft-gold)] focus:text-[var(--deep-ocean)] focus:z-[9999] font-bold rounded-lg outline-none border border-[var(--soft-gold)] transition-all"
      >
        Skip to main content
      </a>
      <LandingNavbar />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-[var(--deep-ocean)] transition-all duration-500 outline-none">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
