"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/* ===== SCROLL REVEAL HOOK (shared pattern) ===== */
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

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse 60% 40% at 30% 30%, rgba(212,175,55,0.08) 0%, transparent 50%),
                       radial-gradient(ellipse 50% 50% at 70% 70%, rgba(59,130,246,0.06) 0%, transparent 50%)`,
        }} />
        <div className="bg-grain" />
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-16 md:pt-44 md:pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <RevealSection>
            <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-6">
              {t("aboutPage.topLabel")}
            </p>
          </RevealSection>
          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">
              {t("aboutPage.titleMain")}{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">{t("aboutPage.titleHighlight")}</span>
            </h1>
          </RevealSection>
          <RevealSection delay={200}>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
              {t("aboutPage.desc")}
            </p>
          </RevealSection>
        </div>
      </section>

      {/* Story Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <RevealSection>
            <div>
              <h2 className="text-3xl font-black text-[var(--text-primary)] mb-6">
                {t("aboutPage.whyTitle")} <span className="text-[var(--soft-gold)]">{t("aboutPage.whyHighlight")}</span>
              </h2>
              <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed text-sm md:text-base">
                <p>{t("aboutPage.whyDesc1")}</p>
                <p>{t("aboutPage.whyDesc2")}</p>
              </div>
            </div>
          </RevealSection>
          <RevealSection delay={200}>
            <div className="command-card p-8 text-center">
              <div className="text-5xl font-black text-[var(--soft-gold)] mb-2">%15</div>
              <p className="text-sm text-[var(--text-secondary)]">
                {t("aboutPage.statLabel")}
              </p>
              <div className="mt-6 h-px bg-white/5" />
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{t("aboutPage.setupTime")}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t("aboutPage.setupLabel")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{t("aboutPage.autoScans")}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t("aboutPage.autoLabel")}</p>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-20 px-6 bg-[#030a15]/30">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                {t("aboutPage.howItWorks")}
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                {t("aboutPage.howItWorksSubtitle")}
              </h2>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: t("aboutPage.step1Title"),
                description: t("aboutPage.step1Desc"),
              },
              {
                step: "02",
                title: t("aboutPage.step2Title"),
                description: t("aboutPage.step2Desc"),
              },
              {
                step: "03",
                title: t("aboutPage.step3Title"),
                description: t("aboutPage.step3Desc"),
              },
            ].map((item, i) => (
              <RevealSection key={i} delay={i * 150}>
                <div className="text-center">
                  <div className="text-5xl font-black text-[var(--soft-gold)]/20 mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{item.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Sentinel Core Loop */}
      <section className="relative z-10 py-20 px-6 border-t border-[var(--overlay-border)] bg-[#030a15]/30">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <span className="text-[var(--soft-gold)] text-xs font-bold uppercase tracking-[0.2em] mb-3 block">
                {t("aboutPage.topLabel")} • ARCHITECTURAL SYSTEM
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">
                Autonomous Sentinel Core Loop
              </h2>
              <p className="text-[var(--text-secondary)] mt-4 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
                How our distributed rate collection nodes and Gemini intelligence agents protect your bottom-line 24/7.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Connection line helper for desktop */}
            <div className="hidden md:block absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-[var(--soft-gold)]/10 via-blue-500/20 to-[var(--soft-gold)]/10 -translate-y-12 z-0 pointer-events-none" />

            {[
              {
                title: "1. Distributed Scrapes",
                desc: "Distributed scraping nodes collect rate packages globally without triggering OTA blocks.",
                badge: "24/7 Active",
                color: "border-blue-500/30 text-blue-400 bg-blue-500/5",
              },
              {
                title: "2. pgvector Alignment",
                desc: "pgvector matches non-standard room listings with 99.4% database accuracy.",
                badge: "pgvector DB",
                color: "border-[var(--soft-gold)]/30 text-[var(--soft-gold)] bg-[var(--soft-gold)]/5",
              },
              {
                title: "3. AnalystAgent AI",
                desc: "Gemini agents evaluate occupancy, competitor compression, and local fair impact.",
                badge: "Gemini AI",
                color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
              },
              {
                title: "4. Dispatch Engine",
                desc: "Slack, SMS, and push dispatches fire instantly on parity leakage detection.",
                badge: "WebHook / SMS",
                color: "border-purple-500/30 text-purple-400 bg-purple-500/5",
              }
            ].map((node, i) => (
              <RevealSection key={i} delay={i * 100} className="relative z-10">
                <div className="command-card p-6 h-full flex flex-col justify-between hover:border-[var(--soft-gold)]/30 transition-all duration-300">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-4 border ${node.color}`}>
                      {node.badge}
                    </span>
                    <h4 className="text-base font-extrabold text-[var(--text-primary)] mb-2.5">{node.title}</h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{node.desc}</p>
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
              {t("aboutPage.ctaTitle")} <span className="text-[var(--soft-gold)]">{t("aboutPage.ctaHighlight")}</span>
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8">
              {t("aboutPage.ctaDesc")}
            </p>
            <Link href="/contact" className="btn-gold text-base py-4 px-8 cursor-pointer">
              {t("aboutPage.ctaButton")}
            </Link>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
