"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Globe, Sun, Moon } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/**
 * Landing Homepage - Hotel Plus
 * Selling point for hotel owners/operators.
 */

/* ===== SCROLL ANIMATION HOOK ===== */
/* EXPLANATION: Uses IntersectionObserver to trigger fade-in-up animations
   as sections enter the viewport. Respects prefers-reduced-motion. */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/* ===== ANIMATED COUNTER ===== */
/* EXPLANATION: Counts up from 0 to target value when visible.
   Used in the social proof stats bar. */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollReveal();

  useEffect(() => {
    if (!isVisible) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isVisible, target]);

  return (
    <span ref={ref} className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
      {count}
      {suffix}
    </span>
  );
}

/* ===== SECTION WRAPPER ===== */
/* EXPLANATION: Reusable wrapper that adds scroll-triggered fade-in-up animation
   to any section. Keeps animation code DRY. */
function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ===== FAQ ACCORDION COMPONENT ===== */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group cursor-pointer"
      >
        <span className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--soft-gold)] transition-colors">
          {question}
        </span>
        <span className={`transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-48 opacity-100 pb-6" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-[var(--text-secondary)] leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

/* ===== FEATURE ICON COMPONENTS ===== */
/* EXPLANATION: SVG icons matching Lucide style. Using inline SVGs instead
   of emojis per ui-ux-pro-max guidelines ("no emoji as icons"). */
function IconChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-8" />
    </svg>
  );
}
function IconRadar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconFileText() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconShare2() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* ===== MAIN HOMEPAGE COMPONENT ===== */
export default function LandingHome() {
  const { locale, t } = useI18n();
  const { theme } = useTheme();

  // CMS Content State - Refactored to use dictionary fallbacks
  const [content, setContent] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const remoteContent = await api.getLandingConfig(locale);
        if (Object.keys(remoteContent).length > 0) {
          // Merge remote with state
          setContent((prev: any) => ({ ...prev, ...remoteContent }));
        } else {
          setContent({});
        }
      } catch (err) {
        console.error("CMS Fetch Failed, using local fallback:", err);
      }
      finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [locale]);

  const toggleTheme = () => {}; // No-op, managed globally
  const toggleLocale = () => {}; // No-op, managed globally

  const hero = content.hero || {};
  const stats = content.stats || [];
  const features = content.features || { items: [] };
  const testimonials = content.testimonials || { items: [] };
  const pricing = content.pricing || { plans: [] };
  const faq = content.faq || { items: [] };
  const footerCta = content.footer_cta || {};

  return (
    <div className="relative overflow-hidden">
      {/* ===== CONTROLS (THEME & LANG) REMOVED - NOW IN NAVBAR ===== */}

      {/* ===== BACKGROUND EFFECTS ===== */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(212,175,55,0.08) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 50% 60% at 50% 80%, rgba(212,175,55,0.04) 0%, transparent 50%)
            `,
          }}
        />
        <div className="bg-grain" />
      </div>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <RevealSection>
            <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-6">
              {hero.top_label || t("landing.hero.topLabel")}
            </p>
          </RevealSection>

          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">
              {hero.title_main || t("landing.hero.titleMain")}{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">
                {hero.title_highlight || t("landing.hero.titleHighlight")}
              </span>{" "}
              {hero.title_suffix || t("landing.hero.titleSuffix")}
            </h1>
          </RevealSection>

          <RevealSection delay={200}>
            <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
              {hero.description || t("landing.hero.description")}
            </p>
          </RevealSection>

          <RevealSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                {hero.cta_primary || t("landing.hero.ctaPrimary")}
              </Link>
              <Link
                href="/pricing"
                className="btn-ghost text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                {hero.cta_secondary || t("landing.hero.ctaSecondary")}
              </Link>
            </div>
          </RevealSection>

          <RevealSection delay={500}>
            <div className="mt-16 md:mt-24 relative max-w-4xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-t from-[var(--soft-gold)]/10 to-transparent rounded-3xl blur-2xl" />
              <div className="relative command-card p-1">
                <div className="bg-[#0a1628] rounded-[18px] p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    <span className="ml-auto text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      {t("analysis.tabs.calendar")} Grid
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-[10px] md:text-xs">
                    <div className="text-[var(--text-muted)] font-bold py-2">{t("landing.table.date")}</div>
                    <div className="text-[var(--soft-gold)] font-bold py-2 text-center">{t("landing.table.yourHotel")}</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">{t("landing.table.compA")}</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">{t("landing.table.compB")}</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">{t("landing.table.compC")}</div>

                    {[
                      { date: new Date(2026, 1, 18), you: 4230, a: 4816, b: 4008, c: 5262 },
                      { date: new Date(2026, 1, 19), you: 4100, a: 4750, b: 4120, c: 5100 },
                      { date: new Date(2026, 1, 20), you: 4350, a: 4900, b: 3980, c: 5400 },
                    ].map((row, i) => (
                      <div key={i} className="contents">
                        <div className="text-[var(--text-secondary)] py-2 border-t border-white/5 uppercase">
                          {row.date.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="text-[var(--soft-gold)] font-bold py-2 text-center border-t border-white/5">
                          {locale === "tr" ? `₺${row.you.toLocaleString()}` : `$${(row.you / 30).toFixed(0)}`}
                        </div>
                        <div className="text-[var(--text-primary)] py-2 text-center border-t border-white/5">
                          {locale === "tr" ? `₺${row.a.toLocaleString()}` : `$${(row.a / 30).toFixed(0)}`}
                        </div>
                        <div className="text-green-400 py-2 text-center border-t border-white/5">
                          {locale === "tr" ? `₺${row.b.toLocaleString()}` : `$${(row.b / 30).toFixed(0)}`}
                        </div>
                        <div className="text-[var(--text-primary)] py-2 text-center border-t border-white/5">
                          {locale === "tr" ? `₺${row.c.toLocaleString()}` : `$${(row.c / 30).toFixed(0)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 py-16 border-y border-white/5 bg-[#030a15]/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.length > 0 ? stats.map((stat: any, i: number) => (
            <RevealSection key={i} delay={i * 100}>
              <div>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                <p className="text-sm text-[var(--text-secondary)] mt-2">{stat.label}</p>
              </div>
            </RevealSection>
          )) : (
            <>
              <RevealSection delay={0}>
                <div>
                  <AnimatedCounter target={50} suffix="+" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">{t("landing.stats.activeHotels")}</p>
                </div>
              </RevealSection>
              <RevealSection delay={100}>
                <div>
                  <AnimatedCounter target={24} suffix="/7" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">{t("landing.stats.scans")}</p>
                </div>
              </RevealSection>
              <RevealSection delay={200}>
                <div>
                  <AnimatedCounter target={98} suffix="%" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">{t("landing.stats.accuracy")}</p>
                </div>
              </RevealSection>
              <RevealSection delay={300}>
                <div>
                  <AnimatedCounter target={500} suffix="K+" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">{t("landing.stats.monitored")}</p>
                </div>
              </RevealSection>
            </>
          )}
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                {features.subtitle || t("landing.features.subtitle")}
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                {features.title || t("landing.features.title")}
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(features.items?.length > 0 ? features.items : [
              { icon: "chart", title: t("landing.features.items.priceIntel.title"), description: t("landing.features.items.priceIntel.desc") },
              { icon: "radar", title: t("landing.features.items.discovery.title"), description: t("landing.features.items.discovery.desc") },
              { icon: "share", title: t("landing.features.items.parity.title"), description: t("landing.features.items.parity.desc") },
              { icon: "users", title: t("landing.features.items.sentiment.title"), description: t("landing.features.items.sentiment.desc") },
              { icon: "bell", title: t("landing.features.items.alerts.title"), description: t("landing.features.items.alerts.desc") },
              { icon: "file", title: t("landing.features.items.reports.title"), description: t("landing.features.items.reports.desc") }
            ]).map((feature: any, i: number) => (
              <RevealSection key={i} delay={i * 100}>
                <div className="command-card p-8 h-full group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--soft-gold)]/10 flex items-center justify-center text-[var(--soft-gold)] mb-5 group-hover:bg-[var(--soft-gold)]/20 transition-colors duration-300">
                    {feature.icon === "chart" && <IconChart />}
                    {feature.icon === "radar" && <IconRadar />}
                    {feature.icon === "share" && <IconShare2 />}
                    {feature.icon === "users" && <IconUsers />}
                    {feature.icon === "bell" && <IconBell />}
                    {feature.icon === "file" && <IconFileText />}
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{feature.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="relative z-10 py-24 px-6 border-y border-white/5 bg-[#030a15]/50">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                {testimonials.subtitle || t("landing.testimonials.subtitle")}
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                {testimonials.title || t("landing.testimonials.title")}
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(testimonials.items?.length > 0 ? testimonials.items : [
              { quote: t("landing.testimonials.items.0.quote"), author: "Ahmet Y.", role: "Genel Müdür, Resort Hotel", initials: "AY" },
              { quote: t("landing.testimonials.items.1.quote"), author: "Zeynep K.", role: "Gelirler Müdürü", initials: "ZK" },
              { quote: t("landing.testimonials.items.2.quote"), author: "Mehmet S.", role: "Otel Sahibi", initials: "MS" }
            ]).map((item: any, i: number) => (
              <RevealSection key={i} delay={i * 100}>
                <div className="command-card p-8 h-full">
                  <div className="flex items-center gap-1 mb-6 text-[var(--soft-gold)]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ))}
                  </div>
                  <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">"{item.quote}"</p>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--soft-gold)]/20 flex items-center justify-center text-[var(--soft-gold)] font-bold text-sm">
                      {item.initials}
                    </div>
                    <div>
                      <div className="text-[var(--text-primary)] font-bold text-sm">{item.author}</div>
                      <div className="text-[var(--text-muted)] text-xs">{item.role}</div>
                    </div>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section className="relative z-10 py-24 px-6 bg-[#030a15]/30">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                {pricing.subtitle || t("landing.pricing.subtitle")}
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                {pricing.title || t("landing.pricing.title")}
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(pricing.plans?.length > 0 ? pricing.plans : [
              { name: t("subscription.starter.name"), price: t("subscription.price.starter"), period: t("subscription.period.mo"), description: t("subscription.starter.description"), features: Object.values(t("subscription.starter.features")), popular: false, cta: t("common.getStarted") },
              { name: t("subscription.pro.name"), price: t("subscription.price.pro"), period: t("subscription.period.mo"), description: t("subscription.pro.description"), features: Object.values(t("subscription.pro.features")), popular: true, cta: t("subscription.mostPopular") },
              { name: t("subscription.enterprise.name"), price: t("subscription.price.enterprise"), period: t("subscription.period.custom"), description: t("subscription.enterprise.description"), features: Object.values(t("subscription.enterprise.features")), popular: false, cta: t("subscription.contactSales") }
            ]).map((plan: any, i: number) => (
              <RevealSection key={i} delay={i * 100}>
                <div
                  className={`command-card p-8 h-full flex flex-col relative ${
                    plan.popular
                      ? "border-[var(--soft-gold)]/30 ring-1 ring-[var(--soft-gold)]/20"
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] text-xs font-bold px-4 py-1 rounded-full">
                      {t("subscription.mostPopular")}
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-3xl font-black text-[var(--text-primary)]">{plan.price}</span>
                    <span className="text-[var(--text-muted)] text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f: string, j: number) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--soft-gold)" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/contact"
                    className={`text-center py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                      plan.popular
                        ? "btn-gold"
                        : "btn-ghost"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <RevealSection>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
                {faq.title || t("landing.faq.title")}
              </h2>
              <p className="text-[var(--text-secondary)]">{faq.subtitle || t("landing.faq.subtitle")}</p>
            </div>
            
            <div className="divide-y divide-white/5 border-y border-white/5">
              {(faq.items?.length > 0 ? faq.items : Object.values(t("landing.faq.items") as any)).map((item: any, i: number) => (
                <FAQItem key={i} question={item.q} answer={item.a} />
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== FINAL CTA SECTION ===== */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealSection>
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-6">
              {footerCta.title || t("landing.footerCta.title")}
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed">
              {footerCta.description || t("landing.footerCta.description")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                {footerCta.cta_primary || t("landing.footerCta.ctaPrimary")}
              </Link>
              <Link
                href="/login"
                className="btn-ghost text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                {footerCta.cta_secondary || t("landing.footerCta.ctaSecondary")}
              </Link>
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
