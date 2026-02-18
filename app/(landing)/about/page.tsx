/**
 * EXPLANATION: About Page (Hakkımızda)
 * 
 * Tells the Hotel Plus story and explains the technology behind
 * the AI-powered rate intelligence platform.
 * 
 * Sections:
 * 1. Hero - Company mission statement
 * 2. Story - How and why Hotel Plus was built  
 * 3. How It Works - 3-step simplified process
 * 4. Values - Core company values
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
              Hakkımızda
            </p>
          </RevealSection>
          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
              Otelcilikte{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">Veri Devrimi</span>
            </h1>
          </RevealSection>
          <RevealSection delay={200}>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
              Hotel Plus, otel sektöründeki fiyatlandırma kararlarını veriye dayalı hale getirmek
              amacıyla kurulmuştur. Yapay zeka ve gerçek zamanlı veri analizi ile
              otelinizin gelirini maksimize etmenize yardımcı oluyoruz.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* Story Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <RevealSection>
            <div>
              <h2 className="text-3xl font-black text-white mb-6">
                Neden <span className="text-[var(--soft-gold)]">Hotel Plus</span>?
              </h2>
              <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                <p>
                  Otel fiyatlandırması karmaşık bir süreçtir. Onlarca rakibi, birden fazla OTA 
                  platformunu ve sürekli değişen pazar koşullarını takip etmek insan gücüyle 
                  neredeyse imkansızdır.
                </p>
                <p>
                  Hotel Plus, bu sorunu yapay zeka ile çözer. Platformumuz 7/24 otomatik tarama 
                  yaparak rakip fiyatlarını toplar, trendleri analiz eder ve anlamlı içgörüler 
                  sunar — böylece siz stratejik kararlara odaklanabilirsiniz.
                </p>
              </div>
            </div>
          </RevealSection>
          <RevealSection delay={200}>
            <div className="command-card p-8 text-center">
              <div className="text-5xl font-black text-[var(--soft-gold)] mb-2">%15</div>
              <p className="text-sm text-[var(--text-secondary)]">
                Ortalama gelir artışı — Hotel Plus kullanan otellerde
              </p>
              <div className="mt-6 h-px bg-white/5" />
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-white">3dk</p>
                  <p className="text-xs text-[var(--text-muted)]">Kurulum süresi</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">7/24</p>
                  <p className="text-xs text-[var(--text-muted)]">Otomatik tarama</p>
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
                Nasıl Çalışır
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white">
                3 Adımda <span className="text-[var(--soft-gold)]">Başlayın</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Otelinizi Ekleyin",
                description: "Otelinizin adını girin, sistem otomatik olarak rakiplerinizi ve OTA kanallarını tespit eder.",
              },
              {
                step: "02",
                title: "AI Tarama Başlasın",
                description: "Yapay zeka motorumuz 7/24 fiyat taraması yapar, değişiklikleri kaydeder ve trendleri analiz eder.",
              },
              {
                step: "03",
                title: "Aksiyon Alın",
                description: "Anlık uyarılar ve akıllı raporlarla doğru zamanda doğru fiyatlandırma kararları verin.",
              },
            ].map((item, i) => (
              <RevealSection key={i} delay={i * 150}>
                <div className="text-center">
                  <div className="text-5xl font-black text-[var(--soft-gold)]/20 mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
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
              Hemen <span className="text-[var(--soft-gold)]">Deneyimleyin</span>
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8">
              Ücretsiz demo ile Hotel Plus&apos;ın gücünü keşfedin.
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
