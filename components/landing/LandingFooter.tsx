/**
 * EXPLANATION: Landing Page Footer
 * 
 * A clean footer for the marketing pages with navigation links,
 * contact info, and branding. Uses the same Deep Ocean + Gold
 * design tokens as the rest of the site.
 */
"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";

export default function LandingFooter() {
  const { t } = useI18n();

  const pages = [
    { href: "/", label: t("landing.nav.home") },
    { href: "/about", label: t("landing.nav.about") },
    { href: "/pricing", label: t("landing.nav.pricing") },
    { href: "/contact", label: t("landing.nav.contact") },
  ];

  const productLinks = [
    { href: "/login", label: t("landing.common.login") },
    { href: "/pricing", label: t("landing.nav.pricing") },
    { href: "/contact", label: t("landing.nav.demo") },
  ];

  return (
    <footer className="relative z-10 border-t border-white/5 bg-[var(--deep-ocean)] transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="mb-4">
              <HotelPlusLogo variant="footer" />
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t("landing.footer.tagline")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">
              {t("landing.footer.pages")}
            </h4>
            <ul className="space-y-2.5">
              {pages.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--soft-gold)] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">
              {t("landing.footer.product")}
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--soft-gold)] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4">
              {t("landing.footer.contact")}
            </h4>
            <ul className="space-y-2.5 text-sm text-[var(--text-secondary)]">
              <li>info@hotelplus.com.tr</li>
              <li>{t("landing.nav.home") === "Home" ? "Turkey" : "Türkiye"}</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            {t("landing.footer.rights")}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em]">
            hotelplustr.com
          </p>
        </div>
      </div>
    </footer>
  );
}
