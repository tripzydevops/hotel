/**
 * EXPLANATION: Dedicated Pricing Page (Fiyatlandırma)
 * 
 * An expanded version of the pricing section with a detailed
 * feature comparison table and FAQ section for objection handling.
 * 
 * Per page-cro skill: pricing pages need clarity + risk reduction.
 * FAQ addresses common objections (commitment, setup, support).
 */
"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

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
  /* FAQ accordion state */
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const plans = [
    {
      name: "Başlangıç",
      price: "₺2.490",
      period: "/ay",
      description: "Tek otel için temel izleme",
      popular: false,
      cta: "Başlayın",
    },
    {
      name: "Profesyonel",
      price: "₺4.990",
      period: "/ay",
      description: "Büyüyen oteller için gelişmiş analiz",
      popular: true,
      cta: "En Popüler",
    },
    {
      name: "Kurumsal",
      price: "Özel",
      period: "",
      description: "Otel zincirleri için tam çözüm",
      popular: false,
      cta: "İletişime Geçin",
    },
  ];

  /* EXPLANATION: Feature comparison rows for the pricing table.
     true = included, false = not included */
  const features = [
    { name: "Otel takibi", values: ["1", "3", "Sınırsız"] },
    { name: "Rakip izleme", values: ["5", "15", "Sınırsız"] },
    { name: "Tarama sıklığı", values: ["Günlük", "Saatlik", "Gerçek zamanlı"] },
    { name: "E-posta uyarıları", values: [true, true, true] },
    { name: "Push bildirimleri", values: [false, true, true] },
    { name: "AI destekli raporlar", values: [false, true, true] },
    { name: "Keşif motoru", values: [false, true, true] },
    { name: "Pazar analizi", values: [false, true, true] },
    { name: "Global Pulse ağı", values: [false, false, true] },
    { name: "API erişimi", values: [false, false, true] },
    { name: "Öncelikli destek", values: [false, false, true] },
  ];

  const faqs = [
    {
      question: "Sözleşme süresi ne kadar?",
      answer: "Aylık veya yıllık abonelik seçeneklerimiz mevcuttur. Yıllık planlarda %20 indirim uygulanır. İstediğiniz zaman iptal edebilirsiniz.",
    },
    {
      question: "Kurulum ne kadar sürer?",
      answer: "Hotel Plus kurulumu ortalama 3 dakika sürer. Otelinizi eklediğiniz anda sistem otomatik olarak rakiplerinizi tespit eder ve taramaya başlar.",
    },
    {
      question: "Deneme süresi var mı?",
      answer: "Evet, tüm planlarımızda 14 günlük ücretsiz deneme süresi mevcuttur. Kredi kartı bilgisi gerekmez.",
    },
    {
      question: "Verilerim güvende mi?",
      answer: "Evet. Tüm veriler SSL ile şifrelenir ve Supabase altyapısında güvenli bir şekilde saklanır. Verilerinize yalnızca siz erişebilirsiniz.",
    },
    {
      question: "Planımı değiştirebilir miyim?",
      answer: "Evet, istediğiniz zaman planınızı yükseltebilir veya düşürebilirsiniz. Değişiklik bir sonraki fatura döneminde geçerli olur.",
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
              Fiyatlandırma
            </p>
          </RevealSection>
          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
              Şeffaf ve{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">Adil Fiyatlandırma</span>
            </h1>
          </RevealSection>
          <RevealSection delay={200}>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
              Her büyüklükteki otel için uygun planlar. 14 gün ücretsiz deneme,
              kredi kartı gerekmez.
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
                className={`command-card p-8 h-full flex flex-col relative ${
                  plan.popular ? "border-[var(--soft-gold)]/30 ring-1 ring-[var(--soft-gold)]/20" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] text-xs font-bold px-4 py-1 rounded-full">
                    En Popüler
                  </div>
                )}
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-[var(--text-muted)] text-sm">{plan.period}</span>
                </div>
                <Link
                  href="/contact"
                  className={`text-center py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer mt-auto ${
                    plan.popular ? "btn-gold" : "btn-ghost"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <RevealSection>
            <h2 className="text-2xl font-bold text-white text-center mb-10">
              Özellik Karşılaştırması
            </h2>
          </RevealSection>
          <RevealSection delay={100}>
            <div className="command-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left p-4 text-[var(--text-muted)] font-bold uppercase tracking-wider text-xs">
                        Özellik
                      </th>
                      {plans.map((plan, i) => (
                        <th key={i} className={`text-center p-4 font-bold text-xs uppercase tracking-wider ${
                          plan.popular ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)]"
                        }`}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="p-4 text-[var(--text-secondary)]">{feature.name}</td>
                        {feature.values.map((val, j) => (
                          <td key={j} className="text-center p-4">
                            {typeof val === "boolean" ? (
                              val ? <span className="inline-flex justify-center"><CheckIcon /></span> : <span className="inline-flex justify-center"><XIcon /></span>
                            ) : (
                              <span className="text-white font-medium">{val}</span>
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
      {/* EXPLANATION: FAQ handles common objections per page-cro skill.
          Accordion pattern keeps page clean while exposing information. */}
      <section className="relative z-10 py-20 px-6 bg-[#030a15]/30">
        <div className="max-w-3xl mx-auto">
          <RevealSection>
            <div className="text-center mb-12">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                SSS
              </p>
              <h2 className="text-3xl font-black text-white">
                Sık Sorulan Sorular
              </h2>
            </div>
          </RevealSection>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <RevealSection key={i} delay={i * 50}>
                <div className="command-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                  >
                    <span className="text-sm font-bold text-white pr-4">{faq.question}</span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="2"
                      className={`shrink-0 transition-transform duration-300 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
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
            <h2 className="text-3xl font-black text-white mb-6">
              Hala Kararsız mısınız?
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8">
              Ücretsiz demo ile Hotel Plus&apos;ı risk almadan deneyin.
            </p>
            <Link href="/contact" className="btn-gold text-base py-4 px-8 cursor-pointer">
              Ücretsiz Demo Talep Edin
            </Link>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
