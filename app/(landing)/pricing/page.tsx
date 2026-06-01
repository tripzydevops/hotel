"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

/* ===== SCROLL REVEAL (shared pattern) ===== */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) { setIsVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, isVisible };
}

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ===== CHECK / X ICONS ===== */
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--soft-gold)" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" opacity="0.4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function PricingPage() {
  const { t, locale } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [rooms, setRooms] = useState(120);
  const [adr, setAdr] = useState(locale === "tr" ? 2500 : 120);

  // Sync ADR on locale shift to avoid slider overflow
  useEffect(() => {
    setAdr(locale === "tr" ? 2500 : 120);
  }, [locale]);

  // Yield calculations
  const monthlyRooms = rooms;
  const avgAdr = adr;
  const occupancy = 0.70;
  const directBookingLift = 0.038;
  const monthlyRecovered = Math.round(monthlyRooms * avgAdr * 30 * occupancy * directBookingLift);
  const monthlySubscriptionCost = locale === "tr" ? 3499 : 149;
  const roiMultiple = (monthlyRecovered / monthlySubscriptionCost).toFixed(1);

  const formatCurrency = (val: number) => {
    return locale === "tr"
      ? `₺${val.toLocaleString("tr-TR")}`
      : `$${val.toLocaleString("en-US")}`;
  };

  const plans = [
    {
      name: t("subscription.starter.name"),
      price: t("subscription.price.starter"),
      period: t("subscription.period.mo"),
      description: t("pricingPage.planStarterDesc"),
      popular: false,
      cta: t("common.getStarted"),
    },
    {
      name: t("subscription.pro.name"),
      price: t("subscription.price.pro"),
      period: t("subscription.period.mo"),
      description: t("pricingPage.planProDesc"),
      popular: true,
      cta: t("subscription.mostPopular"),
    },
    {
      name: t("subscription.enterprise.name"),
      price: t("subscription.price.enterprise"),
      period: t("subscription.period.custom"),
      description: t("pricingPage.planEntDesc"),
      popular: false,
      cta: t("subscription.contactSales"),
    },
  ];

  const features = [
    { name: locale === "tr" ? "Ekli Otel Takibi" : "Competitors Tracked", values: ["5", "25", "100"] },
    { name: locale === "tr" ? "Pazar Karşılaştırma" : "Market Comparisons", values: ["5", "5", "10"] },
    { name: locale === "tr" ? "Tarama Sıklığı" : "Scan Frequency", values: [locale === "tr" ? "Günlük" : "Daily", locale === "tr" ? "Saatlik" : "Hourly", locale === "tr" ? "Gerçek Zamanlı" : "Real-time"] },
    { name: locale === "tr" ? "E-posta Uyarıları" : "Email Alerts", values: [true, true, true] },
    { name: locale === "tr" ? "Mobil Push Bildirimleri" : "Mobile Push Alerts", values: [false, true, true] },
    { name: locale === "tr" ? "Fuar ve Etkinlik Radarı" : "Event & Fair Radar", values: [false, true, true] },
    { name: locale === "tr" ? "Keşif Motoru (pgvector)" : "Discovery Engine (pgvector)", values: [false, true, true] },
    { name: locale === "tr" ? "AI Pazar Analisti Ajanı" : "AI Market Analyst Agent", values: [false, true, true] },
    { name: locale === "tr" ? "Çapraz Dil Memnuniyet Takibi" : "Cross-Language Sentiment Memory", values: [false, false, true] },
    { name: locale === "tr" ? "API Erişimi & Entegrasyonlar" : "API Access & Integrations", values: [false, false, true] },
    { name: locale === "tr" ? "Kurumsal Destek & SLA" : "Enterprise Support & SLA", values: [false, false, true] },
  ];

  const faqs = [
    {
      question: t("pricingPage.objections.0.q"),
      answer: t("pricingPage.objections.0.a"),
    },
    {
      question: t("pricingPage.objections.1.q"),
      answer: t("pricingPage.objections.1.a"),
    },
    {
      question: t("pricingPage.objections.2.q"),
      answer: t("pricingPage.objections.2.a"),
    },
    {
      question: t("pricingPage.objections.3.q"),
      answer: t("pricingPage.objections.3.a"),
    },
    {
      question: t("pricingPage.objections.4.q"),
      answer: t("pricingPage.objections.4.a"),
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 30%, rgba(212,175,55,0.08) 0%, transparent 50%)`,
        }} />
        <div className="bg-grain" />
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-16 md:pt-44 md:pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <RevealSection>
            <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-6">
              {t("pricingPage.topLabel")}
            </p>
          </RevealSection>
          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">
              {t("pricingPage.titleMain")}{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">{t("pricingPage.titleHighlight")}</span>
            </h1>
          </RevealSection>
          <RevealSection delay={200}>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
              {t("pricingPage.desc")}
            </p>
          </RevealSection>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div
                className={`command-card p-8 h-full flex flex-col relative hover:border-[var(--soft-gold)]/20 transition-all duration-300 ${plan.popular ? "border-[var(--soft-gold)]/30 ring-1 ring-[var(--soft-gold)]/20" : ""
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                    {t("subscription.mostPopular")}
                  </div>
                )}
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{plan.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-6 min-h-[40px]">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-[var(--text-primary)]">{plan.price}</span>
                  <span className="text-[var(--text-muted)] text-sm">{plan.period}</span>
                </div>
                <Link
                  href="/contact"
                  className={`text-center py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer mt-auto ${plan.popular ? "btn-gold" : "btn-ghost"
                    }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* B2B Yield ROI Calculator */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <div className="command-card p-8 md:p-10 bg-[#050e1b]/80 backdrop-blur-xl border border-[var(--soft-gold)]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--soft-gold)]/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="text-center mb-8 relative z-10">
                <span className="text-[var(--soft-gold)] text-xs font-bold uppercase tracking-[0.2em] mb-2 block">
                  {t("pricingPage.roi.subtitle")}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)]">
                  {t("pricingPage.roi.title")}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {/* Sliders panel */}
                <div className="space-y-6">
                  {/* Slider 1: Rooms */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] mb-2">
                      <span>{t("pricingPage.roi.roomsLabel")}</span>
                      <span className="text-[var(--soft-gold)] font-black">{rooms}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={rooms}
                      onChange={(e) => setRooms(Number(e.target.value))}
                      className="w-full h-2 bg-[#0c1e36] rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-semibold mt-1">
                      <span>10</span>
                      <span>250</span>
                      <span>500</span>
                    </div>
                  </div>

                  {/* Slider 2: ADR */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] mb-2">
                      <span>{t("pricingPage.roi.adrLabel")}</span>
                      <span className="text-[var(--soft-gold)] font-black">{formatCurrency(adr)}</span>
                    </div>
                    <input
                      type="range"
                      min={locale === "tr" ? 500 : 40}
                      max={locale === "tr" ? 15000 : 600}
                      step={locale === "tr" ? 100 : 5}
                      value={adr}
                      onChange={(e) => setAdr(Number(e.target.value))}
                      className="w-full h-2 bg-[#0c1e36] rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-semibold mt-1">
                      <span>{locale === "tr" ? "₺500" : "$40"}</span>
                      <span>{locale === "tr" ? "₺7.500" : "$320"}</span>
                      <span>{locale === "tr" ? "₺15.000" : "$600"}</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Results Card */}
                <div className="bg-[#030a15]/80 rounded-2xl p-6 border border-white/5 flex flex-col justify-between h-full">
                  <div>
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">
                      {t("pricingPage.roi.estMonthly")}
                    </span>
                    <div className="text-3xl md:text-4xl font-black text-emerald-400 gold-glow-text mb-4">
                      {formatCurrency(monthlyRecovered)}
                    </div>
                    
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-1">
                      {t("pricingPage.roi.roiMultiple")}
                    </span>
                    <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-extrabold border border-emerald-500/30">
                        {t("pricingPage.roi.multipleValue").replace("{val}", roiMultiple)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-6 border-t border-white/5 pt-4">
                    {t("pricingPage.roi.disclaimer")}
                  </p>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-10">
              {t("pricingPage.comparisonTitle")}
            </h2>
          </RevealSection>
          <RevealSection delay={100}>
            <div className="command-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--overlay-border)] bg-white/5">
                      <th className="text-left p-4 text-[var(--text-muted)] font-bold uppercase tracking-wider text-xs">
                        {t("pricingPage.featureCol")}
                      </th>
                      {plans.map((plan, i) => (
                        <th key={i} className={`text-center p-4 font-bold text-xs uppercase tracking-wider ${plan.popular ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)]"
                          }`}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, i) => (
                      <tr key={i} className="border-b border-[var(--overlay-border)] last:border-0 hover:bg-white/5 transition-all">
                        <td className="p-4 text-[var(--text-secondary)] font-medium">{feature.name}</td>
                        {feature.values.map((val, j) => (
                          <td key={j} className="text-center p-4">
                            {typeof val === "boolean" ? (
                              val ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><XIcon /></span>
                            ) : (
                              <span className="text-[var(--text-primary)] font-bold">{val}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-20 px-6 bg-[#030a15]/30">
        <div className="max-w-3xl mx-auto">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                {t("pricingPage.faqTitle")}
              </p>
              <h2 className="text-3xl font-black text-[var(--text-primary)]">
                {t("pricingPage.faqSubtitle")}
              </h2>
            </div>
          </RevealSection>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <RevealSection key={i} delay={i * 50}>
                <div className="command-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-white/5 transition-all"
                  >
                    <span className="text-sm font-bold text-[var(--text-primary)] pr-4">{faq.question}</span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="2"
                      className={`shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""
                        }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                      }`}
                  >
                    <p className="px-5 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealSection>
            <h2 className="text-3xl font-black text-[var(--text-primary)] mb-6">
              {t("pricingPage.objectionTitle")}
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8">
              {t("pricingPage.objectionDesc")}
            </p>
            <Link href="/contact" className="btn-gold text-base py-4 px-8 cursor-pointer">
              {t("pricingPage.objectionCta")}
            </Link>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
