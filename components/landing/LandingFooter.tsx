/**
 * EXPLANATION: Landing Page Footer
 * 
 * A clean footer for the marketing pages with navigation links,
 * contact info, and branding. Uses the same Deep Ocean + Gold
 * design tokens as the rest of the site.
 */
import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-[#030a15]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl font-black text-white tracking-tight">
                Hotel <span className="text-[var(--soft-gold)]">Plus</span>
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Yapay zeka destekli otel fiyat izleme ve rekabet analizi platformu.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Sayfalar
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/", label: "Ana Sayfa" },
                { href: "/about", label: "Hakkımızda" },
                { href: "/pricing", label: "Fiyatlandırma" },
                { href: "/contact", label: "İletişim" },
              ].map((link) => (
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
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Ürün
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/login", label: "Oturum Aç" },
                { href: "/pricing", label: "Fiyatlandırma" },
                { href: "/contact", label: "Demo Talebi" },
              ].map((link) => (
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
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              İletişim
            </h4>
            <ul className="space-y-2.5 text-sm text-[var(--text-secondary)]">
              <li>info@hotelplus.com.tr</li>
              <li>Balıkesir, Türkiye</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            © 2026 Hotel Plus. Tüm hakları saklıdır.
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em]">
            Powered by Rate Sentinel AI
          </p>
        </div>
      </div>
    </footer>
  );
}
