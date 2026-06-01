"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shield, Users, BarChart3, Bell, CheckCircle, Zap, Cpu, Server, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/**
 * Revamped Landing Homepage - Hotel Plus
 * Powered by Hotel Rate Sentinel (Enterprise Core)
 * Selling point for hotel owners, GMs, and chain operators.
 */

/* Scroll animation hook for fade-in effects */
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
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/* Animated counter for stats */
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

/* Reusable section wrapper for scroll reveals */
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
    <div className="border-b border-[var(--overlay-border)] last:border-0">
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

/* Icons */
function IconChart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-8" />
    </svg>
  );
}
function IconRadar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconFileText() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconShare2() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function IconCpu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
    </svg>
  );
}

/* ===== MAIN HOMEPAGE COMPONENT ===== */
export default function LandingHome() {
  const { locale, t } = useI18n();

  // CMS Content State
  const [content, setContent] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Interactive Widgets State
  const [undercutActive, setUndercutActive] = useState(false);
  const [marketCompression, setMarketCompression] = useState(30);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const remoteContent = await api.getLandingConfig(locale);
        if (Object.keys(remoteContent).length > 0) {
          setContent((prev: any) => ({ ...prev, ...remoteContent }));
        }
      } catch (err) {
        console.error("CMS Fetch Failed, using local fallback:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [locale]);

  const hero = content.hero || {};
  const stats = content.stats || [];
  const features = content.features || { items: [] };
  const testimonials = content.testimonials || { items: [] };
  const pricing = content.pricing || { plans: [] };
  const faq = content.faq || { items: [] };
  const footerCta = content.footer_cta || {};

  // Dynamic values for AI Market Analyst Simulator
  const getAIAdvisory = (val: number) => {
    if (locale === "tr") {
      if (val <= 20) {
        return {
          intensity: "Düşük Yoğunluk (Sezon Dışı)",
          color: "border-green-500/30 text-green-400 bg-green-500/5",
          strategy: "Rakipler fiyatları aşağı çekiyor. AI Tavsiyesi: Taban fiyat seviyelerinizi koruyun ancak pazar hacmini yakalamak için esnek iptal veya ücretsiz kahvaltı gibi doğrudan rezervasyon tekliflerini öne çıkarın.",
          confidence: "Mükemmel (%94)",
        };
      } else if (val <= 50) {
        return {
          intensity: "Stabil Talep (Normal Pazar)",
          color: "border-blue-500/30 text-blue-400 bg-blue-500/5",
          strategy: "Pazar dengeli seyrediyor. Yerel etkinlik hacminde %8 artış var. AI Tavsiyesi: Rakiplerin ortalamasına sadık kalın. Ortalama Fiyat Endeksinizi (ARI) 101 seviyesinde tutarak doluluk dengenizi optimize edin.",
          confidence: "Yüksek (%89)",
        };
      } else if (val <= 80) {
        return {
          intensity: "Yüksek Sıkışma (Etkinlik Uyarısı)",
          color: "border-orange-500/30 text-orange-400 bg-orange-500/5",
          strategy: "Bölgenizde 3 adet kongre/etkinlik tespit edildi (Yaklaşık 18.000 katılımcı). AI Tavsiyesi: Rakipler fiyatlarını %15 artırdı. Doluluk kaybı yaşamadan kârınızı maksimize etmek için doğrudan fiyatlarınızı hemen %10 artırın.",
          confidence: "Çok Yüksek (%97)",
        };
      } else {
        return {
          intensity: "Maksimum Doluluk (Pik Seviye)",
          color: "border-red-500/30 text-red-400 bg-red-500/5",
          strategy: "Pazar doluluk oranı %92'yi aştı. Rakiplerin çoğunda oda tükendi. AI Tavsiyesi: Geliri zirveye taşımak için fiyatlarınızı medyanın %30 üzerine çekin. Güçlü misafir memnuniyet puanınız bu artışı tam olarak destekliyor.",
          confidence: "Maksimum (%99)",
        };
      }
    } else {
      if (val <= 20) {
        return {
          intensity: "Low Intensity (Off-Season)",
          color: "border-green-500/30 text-green-400 bg-green-500/5",
          strategy: "Rivals are running conservative rates. AI Strategy: Maintain baseline rates but highlight direct booking value-adds (free breakfast/flexible cancellation) to capture organic volume without diluting price.",
          confidence: "Excellent (94%)",
        };
      } else if (val <= 50) {
        return {
          intensity: "Stable Demand (Standard Market)",
          color: "border-blue-500/30 text-blue-400 bg-blue-500/5",
          strategy: "Market is balanced. Local event traffic is up by 8%. AI Strategy: Match competitor averages. Ensure your Average Rate Index (ARI) stays near 101 to optimize the delicate balance of occupancy and ADR.",
          confidence: "High (89%)",
        };
      } else if (val <= 80) {
        return {
          intensity: "High Compression (Event Trigger)",
          color: "border-orange-500/30 text-orange-400 bg-orange-500/5",
          strategy: "PredictHQ detects 3 major regional events (18K total attendees). AI Strategy: Competitors are raising rates by 15%. Dynamically increase your direct price by 10% immediately to capture event premium.",
          confidence: "Very High (97%)",
        };
      } else {
        return {
          intensity: "Extreme Peak (Rivals Sold Out)",
          color: "border-red-500/30 text-red-400 bg-red-500/5",
          strategy: "Market occupancy exceeds 92%. Competitor hotels are sold out. AI Strategy: Maximize RevPAR. Command a 30% premium over the market median. Your superior guest sentiment score fully supports this luxury tier.",
          confidence: "Maximum (99%)",
        };
      }
    }
  };

  const currentBrief = getAIAdvisory(marketCompression);

  return (
    <div className="relative overflow-hidden">
      {/* ===== BACKGROUND EFFECTS ===== */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(212,175,55,0.09) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(59,130,246,0.07) 0%, transparent 50%),
              radial-gradient(ellipse 50% 60% at 50% 80%, rgba(212,175,55,0.05) 0%, transparent 50%)
            `,
          }}
        />
        <div className="bg-grain" />
      </div>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <RevealSection>
            <div className="inline-flex items-center gap-2 border border-[var(--soft-gold)]/20 px-4 py-1.5 rounded-full bg-[var(--soft-gold)]/5 text-[var(--soft-gold)] text-xs font-bold uppercase tracking-[0.2em] mb-8">
              <Shield className="w-3.5 h-3.5" />
              {hero.top_label || t("landing.hero.topLabel")}
            </div>
          </RevealSection>

          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">
              {hero.titleMain || t("landing.hero.titleMain")}{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">
                {hero.titleHighlight || t("landing.hero.titleHighlight")}
              </span>{" "}
              {hero.titleSuffix || t("landing.hero.titleSuffix")}
            </h1>
          </RevealSection>

          <RevealSection delay={200}>
            <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-10 leading-relaxed">
              {hero.description || t("landing.hero.description")}
            </p>
          </RevealSection>

          <RevealSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[var(--soft-gold)]/10"
              >
                <Zap className="w-4 h-4 fill-current" />
                {hero.ctaPrimary || t("landing.hero.ctaPrimary")}
              </Link>
              <Link
                href="/pricing"
                className="btn-ghost text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                {hero.ctaSecondary || t("landing.hero.ctaSecondary")}
              </Link>
            </div>
          </RevealSection>

          {/* ===== INTERACTIVE DEMO 1: LIVE PARITY PULSE ===== */}
          <RevealSection delay={500}>
            <div className="mt-20 md:mt-24 relative max-w-4xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-t from-[var(--soft-gold)]/10 to-transparent rounded-3xl blur-2xl opacity-70" />
              <div className="relative command-card p-1">
                <div className="bg-[#050e1b] rounded-[18px] p-6 md:p-8">
                  
                  {/* Grid Header & Simulator Controls */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-[var(--overlay-border)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        {locale === "tr" ? "Parite Denetim Nabzı" : "Live Parity Audit Pulse"}
                      </span>
                    </div>

                    <button
                      onClick={() => setUndercutActive(!undercutActive)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer flex items-center gap-2 border ${
                        undercutActive
                          ? "btn-gold border-[var(--soft-gold)] text-[var(--deep-ocean)]"
                          : "border-white/10 text-[var(--text-secondary)] hover:bg-white/5"
                      }`}
                    >
                      <Zap className={`w-3.5 h-3.5 ${undercutActive ? "fill-current" : ""}`} />
                      {undercutActive
                        ? (locale === "tr" ? "Komplo Aktif (İhlal Tespit Edildi)" : "Active Undercut (Violation Caught)")
                        : (locale === "tr" ? "OTA İhlali Simüle Et" : "Simulate OTA Price Undercut")}
                    </button>
                  </div>

                  {/* Pricing Comparison Grid */}
                  <div className="grid grid-cols-4 gap-3 text-left text-xs mb-6">
                    <div className="text-[var(--text-muted)] font-semibold">{locale === "tr" ? "Kanal / Tesis" : "Booking Channel"}</div>
                    <div className="text-center text-[var(--text-muted)] font-semibold">{locale === "tr" ? "Standart Oda" : "Standard Double"}</div>
                    <div className="text-center text-[var(--text-muted)] font-semibold">{locale === "tr" ? "Fark Oranı" : "Discrepancy"}</div>
                    <div className="text-right text-[var(--text-muted)] font-semibold">{locale === "tr" ? "Durum" : "Status"}</div>

                    {/* Direct rate row */}
                    <div className="contents font-bold">
                      <div className="py-3 border-t border-[var(--overlay-border)] text-[var(--soft-gold)] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
                        {locale === "tr" ? "Otel Web Siteniz (Doğrudan)" : "Your Official Site (Direct)"}
                      </div>
                      <div className="py-3 text-center border-t border-[var(--overlay-border)] text-[var(--soft-gold)]">
                        {locale === "tr" ? "₺4.500" : "$150"}
                      </div>
                      <div className="py-3 text-center border-t border-[var(--overlay-border)] text-[var(--text-muted)]">-</div>
                      <div className="py-3 text-right border-t border-[var(--overlay-border)] text-emerald-400 uppercase tracking-widest text-[10px]">
                        {locale === "tr" ? "Doğru Fiyat" : "Best Rate"}
                      </div>
                    </div>

                    {/* Booking.com row */}
                    <div className="contents">
                      <div className="py-3 border-t border-[var(--overlay-border)] text-[var(--text-secondary)]">Booking.com</div>
                      <div className="py-3 text-center border-t border-[var(--overlay-border)] text-[var(--text-primary)]">
                        {locale === "tr" ? "₺4.500" : "$150"}
                      </div>
                      <div className="py-3 text-center border-t border-[var(--overlay-border)] text-emerald-400">0%</div>
                      <div className="py-3 text-right border-t border-[var(--overlay-border)] text-emerald-400/80 text-[10px] uppercase font-medium">
                        {locale === "tr" ? "Senkronize" : "Parity Match"}
                      </div>
                    </div>

                    {/* Expedia row (undercut target) */}
                    <div className={`contents transition-all duration-500 ${undercutActive ? "bg-red-500/10 text-red-200" : ""}`}>
                      <div className={`py-3 border-t border-[var(--overlay-border)] text-[var(--text-secondary)] font-medium ${undercutActive ? "text-red-400 font-bold" : ""}`}>
                        Expedia
                      </div>
                      <div className={`py-3 text-center border-t border-[var(--overlay-border)] text-[var(--text-primary)] ${undercutActive ? "text-red-400 font-black scale-105" : ""}`}>
                        {undercutActive
                          ? (locale === "tr" ? "₺3.800" : "$126")
                          : (locale === "tr" ? "₺4.500" : "$150")}
                      </div>
                      <div className={`py-3 text-center border-t border-[var(--overlay-border)] ${undercutActive ? "text-red-400 font-bold" : "text-[var(--text-muted)]"}`}>
                        {undercutActive ? "-16%" : "0%"}
                      </div>
                      <div className="py-3 text-right border-t border-[var(--overlay-border)]">
                        {undercutActive ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] uppercase font-bold tracking-widest animate-pulse border border-red-500/30">
                            {locale === "tr" ? "İHLAL VAR" : "VIOLATION"}
                          </span>
                        ) : (
                          <span className="text-emerald-400/80 text-[10px] uppercase font-medium">
                            {locale === "tr" ? "Senkronize" : "Parity Match"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pulsing Alert banner when undercut active */}
                  {undercutActive && (
                    <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs md:text-sm font-semibold flex items-center gap-3 animate-fade-in text-left">
                      <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <div>
                        <p className="font-bold text-red-200 uppercase tracking-wide">
                          {locale === "tr" ? "Sentinel Engelleyici Uyarısı: Fiyat Kaybı Tespit Edildi" : "Sentinel Action Triggered: Parity Leak Found"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-normal">
                          {locale === "tr" 
                            ? "Expedia fiyatı resmi sitenizin 700 ₺ altında! AI Sentinel otomatik olarak log kaydı tuttu ve parite ihlali alarmını gelir ekibine iletti."
                            : "Expedia is undercutting your direct rate by $24. The otonom ParityAgent has captured the logs and dispatched an alert to your revenue management slack channel."
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 py-16 border-y border-[var(--overlay-border)] bg-[#030a15]/50">
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
                  <p className="text-sm text-[var(--text-secondary)] mt-2">Active Hotels</p>
                </div>
              </RevealSection>
              <RevealSection delay={100}>
                <div>
                  <AnimatedCounter target={24} suffix="/7" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">Autonomous Scans</p>
                </div>
              </RevealSection>
              <RevealSection delay={200}>
                <div>
                  <AnimatedCounter target={99} suffix="." />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">ARI Accuracy Rate</p>
                </div>
              </RevealSection>
              <RevealSection delay={300}>
                <div>
                  <AnimatedCounter target={650} suffix="K+" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">Monitored Rates</p>
                </div>
              </RevealSection>
            </>
          )}
        </div>
      </section>

      {/* ===== INTERACTIVE DEMO 2: AI MARKET ANALYST SIMULATOR ===== */}
      <section className="relative z-10 py-24 px-6 bg-[#030a15]/30 border-b border-[var(--overlay-border)]">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-1 border border-blue-500/20 px-3.5 py-1 rounded-full bg-blue-500/5 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Cpu className="w-3.5 h-3.5" />
                {locale === "tr" ? "Otonom Yapay Zeka Deneyimi" : "Otonom AI Experience"}
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                {locale === "tr" ? "AI Pazar Analisti Simülatörü" : "AI Market Analyst Simulator"}
              </h2>
              <p className="text-[var(--text-secondary)] mt-4 max-w-2xl mx-auto leading-relaxed">
                {locale === "tr"
                  ? "Piyasadaki rakip doluluk seviyelerini ve etkinlik yoğunluğunu ayarlayarak, otonom kararlar üreten AnalystAgent'ın pazar reflekslerini deneyimleyin."
                  : "Drag the slider to adjust competitor rate compression and event density. Watch our otonom AnalystAgent synthesize dynamic strategy recommendations in real-time."
                }
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={150}>
            <div className="command-card p-6 md:p-8">
              
              {/* Slider Input */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-sm font-bold text-[var(--text-primary)] mb-3">
                  <span>{locale === "tr" ? "Rakip Fiyat Sıkışması & Talep Yoğunluğu" : "Competitor Compression & Market Intensity"}</span>
                  <span className="text-[var(--soft-gold)] font-black text-lg">{marketCompression}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={marketCompression}
                  onChange={(e) => setMarketCompression(Number(e.target.value))}
                  className="w-full h-2 bg-[#0c1e36] rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-semibold mt-2 uppercase tracking-wide">
                  <span>{locale === "tr" ? "Düşük Sezon" : "Low Season"}</span>
                  <span>{locale === "tr" ? "Stabil Pazar" : "Standard"}</span>
                  <span>{locale === "tr" ? "Yüksek Talep" : "High Demand"}</span>
                  <span>{locale === "tr" ? "Pik Hacim" : "Peak SOLD-OUT"}</span>
                </div>
              </div>

              {/* Dynamic Advisory Output Box */}
              <div className="relative">
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)]" />
                  <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {locale === "tr" ? "ANALYSTAGENT İNCELİYOR" : "AnalystAgent Output"}
                  </span>
                </div>

                <div className="bg-[#050e1b] rounded-2xl p-5 md:p-6 border border-white/5 text-left transition-all duration-300">
                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${currentBrief.color} tracking-wider`}>
                      {currentBrief.intensity}
                    </span>
                  </div>
                  
                  <p className="text-[var(--text-primary)] font-medium leading-relaxed text-sm md:text-base">
                    "{currentBrief.strategy}"
                  </p>

                  <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--text-secondary)]">{locale === "tr" ? "Analiz Güveni:" : "Confidence Score:"}</span>
                      <span className="font-extrabold text-emerald-400">{currentBrief.confidence}</span>
                    </div>
                    <div>
                      {locale === "tr" ? "Gemini 3.5 Flash B2B İstihbaratı" : "Powered by Gemini 3.5 Flash"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== PERSONAS SECTION ===== */}
      <section className="relative z-10 py-24 px-6 bg-[#030a15]/20 border-b border-[var(--overlay-border)]">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-1 border border-[var(--soft-gold)]/20 px-3 py-1 rounded-full bg-[var(--soft-gold)]/5 text-[var(--soft-gold)] text-xs font-bold uppercase tracking-wider mb-4">
                <Users className="w-3.5 h-3.5" />
                {t("landing.personas.subtitle")}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)]">
                {t("landing.personas.title")}
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RevealSection delay={100}>
              <div className="command-card p-8 h-full flex flex-col">
                <span className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 block">
                  {t("landing.personas.owner.tag")}
                </span>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                  {t("landing.personas.owner.title")}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 flex-1">
                  {t("landing.personas.owner.desc")}
                </p>
                <div className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest pt-4 border-t border-white/5">
                  {locale === "tr" ? "» Kârlılık Odaklı" : "» Bottom-Line Protection"}
                </div>
              </div>
            </RevealSection>

            <RevealSection delay={200}>
              <div className="command-card p-8 h-full flex flex-col border-[var(--soft-gold)]/10 ring-1 ring-[var(--soft-gold)]/5">
                <span className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 block">
                  {t("landing.personas.gm.tag")}
                </span>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                  {t("landing.personas.gm.title")}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 flex-1">
                  {t("landing.personas.gm.desc")}
                </p>
                <div className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest pt-4 border-t border-white/5">
                  {locale === "tr" ? "» %100 Operasyonel Tasarruf" : "» 100% Workflow Savings"}
                </div>
              </div>
            </RevealSection>

            <RevealSection delay={300}>
              <div className="command-card p-8 h-full flex flex-col">
                <span className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 block">
                  {t("landing.personas.revenue.tag")}
                </span>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                  {t("landing.personas.revenue.title")}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 flex-1">
                  {t("landing.personas.revenue.desc")}
                </p>
                <div className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest pt-4 border-t border-white/5">
                  {locale === "tr" ? "» pgvector Rekabet Keşfi" : "» Semantic pgvector Mapping"}
                </div>
              </div>
            </RevealSection>
          </div>
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
                <div className="command-card p-8 h-full group cursor-pointer hover:border-[var(--soft-gold)]/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/5 flex items-center justify-center text-[var(--soft-gold)] mb-5 group-hover:bg-[var(--soft-gold)]/10 transition-colors duration-300 border border-[var(--soft-gold)]/10">
                    {(feature.icon === "priceIntel" || feature.icon === "chart") && <IconChart />}
                    {(feature.icon === "discovery" || feature.icon === "radar") && <IconRadar />}
                    {(feature.icon === "parity" || feature.icon === "share") && <IconShare2 />}
                    {(feature.icon === "sentiment" || feature.icon === "users" || feature.icon === "cpu") && <IconCpu />}
                    {(feature.icon === "alerts" || feature.icon === "bell") && <IconBell />}
                    {(feature.icon === "reports" || feature.icon === "file") && <IconFileText />}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">{feature.title}</h3>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ENTERPRISE COMPLIANCE & TRUST BANNER ===== */}
      <section className="relative z-10 py-16 border-y border-[var(--overlay-border)] bg-[#030a15]/60 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center text-center">
            
            <div className="flex flex-col items-center justify-center p-4">
              <Server className="w-6 h-6 text-[var(--soft-gold)] mb-2.5 opacity-80" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">SOC 2 Audited</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">{locale === "tr" ? "Güvenli Sistem Altyapısı" : "Secure BaaS Storage"}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 border-l border-white/5 md:border-l">
              <Shield className="w-6 h-6 text-[var(--soft-gold)] mb-2.5 opacity-80" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">GDPR & KVKK</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">{locale === "tr" ? "Kişisel Veri Silme Güvencesi" : "Automated DSAR Purging"}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 border-l border-white/5 md:border-l">
              <CheckCircle className="w-6 h-6 text-[var(--soft-gold)] mb-2.5 opacity-80" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">PCI Scope Exclusion</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">{locale === "tr" ? "SAQ-A Finansal Muafiyet" : "Strict SAQ-A Data Boundary"}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 border-l border-white/5 md:border-l">
              <Lock className="w-6 h-6 text-[var(--soft-gold)] mb-2.5 opacity-80" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">PoLP Access Control</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-1">{locale === "tr" ? "TOTP İki Faktörlü Yetki" : "TOTP Operator MFA Enforced"}</span>
            </div>

          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="relative z-10 py-24 px-6 border-b border-[var(--overlay-border)] bg-[#030a15]/30">
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
              { quote: t("landing.testimonials.items.0.quote"), author: "Ahmet Y.", role: t("landing.testimonials.items.0.role"), initials: "AY" },
              { quote: t("landing.testimonials.items.1.quote"), author: "Zeynep K.", role: t("landing.testimonials.items.1.role"), initials: "ZK" },
              { quote: t("landing.testimonials.items.2.quote"), author: "Mehmet S.", role: t("landing.testimonials.items.2.role"), initials: "MS" }
            ]).map((item: any, i: number) => (
              <RevealSection key={i} delay={i * 100}>
                <div className="command-card p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 mb-6 text-[var(--soft-gold)]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg key={star} width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      ))}
                    </div>
                    <p className="text-[var(--text-secondary)] mb-6 leading-relaxed italic">"{item.quote}"</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--soft-gold)]/10 flex items-center justify-center text-[var(--soft-gold)] font-bold text-sm border border-[var(--soft-gold)]/20">
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
      <section className="relative z-10 py-24 px-6 bg-[#030a15]/10">
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
              { name: t("subscription.starter.name"), price: t("subscription.price.starter"), period: t("subscription.period.mo"), description: t("subscription.starter.description"), features: [t("subscription.starter.features.0"), t("subscription.starter.features.1"), t("subscription.starter.features.2"), t("subscription.starter.features.3")], popular: false, cta: t("common.getStarted") },
              { name: t("subscription.pro.name"), price: t("subscription.price.pro"), period: t("subscription.period.mo"), description: t("subscription.pro.description"), features: [t("subscription.pro.features.0"), t("subscription.pro.features.1"), t("subscription.pro.features.2"), t("subscription.pro.features.3"), t("subscription.pro.features.4")], popular: true, cta: t("subscription.mostPopular") },
              { name: t("subscription.enterprise.name"), price: t("subscription.price.enterprise"), period: t("subscription.period.custom"), description: t("subscription.enterprise.description"), features: [t("subscription.enterprise.features.0"), t("subscription.enterprise.features.1"), t("subscription.enterprise.features.2"), t("subscription.enterprise.features.3"), t("subscription.enterprise.features.4")], popular: false, cta: t("subscription.contactSales") }
            ]).map((plan: any, i: number) => (
              <RevealSection key={i} delay={i * 100}>
                <div
                  className={`command-card p-8 h-full flex flex-col relative hover:border-[var(--soft-gold)]/20 transition-all duration-300 ${
                    plan.popular
                      ? "border-[var(--soft-gold)]/30 ring-1 ring-[var(--soft-gold)]/20"
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--soft-gold)" strokeWidth="2.5">
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
            
            <div className="divide-y divide-white/5 border-y border-[var(--overlay-border)]">
              {(faq.items?.length > 0 ? faq.items : [
                { q: t("landing.faq.items.0.q"), a: t("landing.faq.items.0.a") },
                { q: t("landing.faq.items.1.q"), a: t("landing.faq.items.1.a") },
                { q: t("landing.faq.items.2.q"), a: t("landing.faq.items.2.a") },
                { q: t("landing.faq.items.3.q"), a: t("landing.faq.items.3.a") }
              ]).map((item: any, i: number) => (
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
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" />
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
