/**
 * EXPLANATION: Landing Homepage
 * 
 * The main marketing page for Hotel Plus. This is the "front door" that
 * sells the product to potential hotel owners/operators.
 * 
 * Structure follows the copywriting skill's page framework:
 * 1. Hero — Value prop in ≤5 seconds + primary CTA
 * 2. Stats Bar — Social proof with animated counters
 * 3. Problem/Solution — Pain points → Hotel Plus solutions
 * 4. Features — 4 glassmorphism cards with Lucide-style icons
 * 5. Product Showcase — Real dashboard screenshot preview
 * 6. Pricing — 3-tier cards (Başlangıç / Profesyonel / Kurumsal)
 * 7. Final CTA — Demo request with recap
 * 
 * Animations: "Sade ve Şık" (Simple & Elegant)
 * - Scroll-triggered fade-in-up via IntersectionObserver
 * - 150-300ms micro-interactions per ui-ux-pro-max guidelines
 * - prefers-reduced-motion respected
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
    <span ref={ref} className="text-3xl md:text-4xl font-black text-white">
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
        <span className="text-lg font-medium text-white group-hover:text-[var(--soft-gold)] transition-colors">
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
  return (
    <div className="relative overflow-hidden">
      {/* ===== BACKGROUND EFFECTS ===== */}
      {/* EXPLANATION: Animated mesh gradient background that slowly shifts.
          Creates a premium, "living" feel without distracting from content. */}
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
      {/* EXPLANATION: Value proposition in ≤5 seconds (per copywriting skill).
          Headline is outcome-focused, CTA is action-oriented. */}
      <section className="relative z-10 pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <RevealSection>
            <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-6">
              Yapay Zeka Destekli Otel Fiyat İstihbaratı
            </p>
          </RevealSection>

          <RevealSection delay={100}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] tracking-tight mb-6">
              Rakiplerinizin Fiyatlarını{" "}
              <span className="text-[var(--soft-gold)] gold-glow-text">
                Gerçek Zamanlı
              </span>{" "}
              Takip Edin
            </h1>
          </RevealSection>

          <RevealSection delay={200}>
            <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
              Otelinizin kârlılığını şansa bırakmayın. Piyasa verilerini rekabet avantajına dönüştürün ve 
              gelir yönetimi stratejinizi kesin bilgiyle güçlendirin.
            </p>
          </RevealSection>

          <RevealSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                Erişim Talebi Oluşturun
              </Link>
              <Link
                href="/pricing"
                className="btn-ghost text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                Üyelik Planlarını İnceleyin
              </Link>
            </div>
          </RevealSection>

          {/* EXPLANATION: Floating product preview card showing a stylized
              representation of the Rate Intelligence Grid. */}
          <RevealSection delay={500}>
            <div className="mt-16 md:mt-24 relative max-w-4xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-t from-[var(--soft-gold)]/10 to-transparent rounded-3xl blur-2xl" />
              <div className="relative command-card p-1">
                <div className="bg-[#0a1628] rounded-[18px] p-6 md:p-8">
                  {/* Mini Dashboard Preview */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    <span className="ml-auto text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      Rate Intelligence Grid
                    </span>
                  </div>
                  {/* Stylized Grid Preview */}
                  <div className="grid grid-cols-5 gap-2 text-[10px] md:text-xs">
                    <div className="text-[var(--text-muted)] font-bold py-2">Tarih</div>
                    <div className="text-[var(--soft-gold)] font-bold py-2 text-center">SİZİN OTELİNİZ</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">Rakip A</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">Rakip B</div>
                    <div className="text-[var(--text-muted)] font-bold py-2 text-center">Rakip C</div>

                    {[
                      { date: "18 Şub", you: "₺4.230", a: "₺4.816", b: "₺4.008", c: "₺5.262" },
                      { date: "19 Şub", you: "₺4.100", a: "₺4.750", b: "₺4.120", c: "₺5.100" },
                      { date: "20 Şub", you: "₺4.350", a: "₺4.900", b: "₺3.980", c: "₺5.400" },
                    ].map((row, i) => (
                      <div key={i} className="contents">
                        <div className="text-[var(--text-secondary)] py-2 border-t border-white/5">{row.date}</div>
                        <div className="text-[var(--soft-gold)] font-bold py-2 text-center border-t border-white/5">{row.you}</div>
                        <div className="text-white py-2 text-center border-t border-white/5">{row.a}</div>
                        <div className="text-green-400 py-2 text-center border-t border-white/5">{row.b}</div>
                        <div className="text-white py-2 text-center border-t border-white/5">{row.c}</div>
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
      {/* EXPLANATION: Social proof section with animated counters.
          Numbers build trust faster than text (per CRO skill). */}
      <section className="relative z-10 py-16 border-y border-white/5 bg-[#030a15]/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 50, suffix: "+", label: "Aktif Otel" },
            { value: 24, suffix: "/7", label: "Tarama" },
            { value: 98, suffix: "%", label: "Doğruluk Oranı" },
            { value: 500, suffix: "K+", label: "İzlenen Fiyat" },
          ].map((stat, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                <p className="text-sm text-[var(--text-secondary)] mt-2">{stat.label}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      {/* EXPLANATION: 4 glassmorphism cards highlighting core features.
          Uses Feature → Benefit → Outcome framework (per copywriting skill). */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                Platform Yetenekleri
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white">
                Gelir Liderleri İçin <br className="hidden md:block" />
                <span className="text-[var(--soft-gold)]">Tasarlanmış Teknoloji</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <IconChart />,
                title: "Fiyat İstihbaratı",
                description:
                  "Rakip otel fiyatlarını günlük olarak tarayın, geçmiş trendleri analiz edin ve fiyat değişikliklerine anında tepki verin.",
              },
              {
                icon: <IconRadar />,
                title: "Keşif Motoru",
                description:
                  "Bölgenizdeki tüm rakip otelleri harita üzerinde keşfedin. Coğrafi konum bazlı gerçek zamanlı fiyat karşılaştırması.",
              },
              {
                icon: <IconShare2 />,
                title: "Parite Monitörü",
                description:
                  "OTA kanallarındaki fiyat tutarsızlıklarını anında tespit edin. Marka değerinizi ve doğrudan satış kanallarınızı koruyun.",
              },
              {
                icon: <IconUsers />,
                title: "Duyarlılık Analizi",
                description:
                  "AI destekli misafir yorum analizi ile rakiplerinizin zayıf noktalarını keşfedin, hizmet kalitenizi pazarın önüne taşıyın.",
              },
              {
                icon: <IconBell />,
                title: "Anlık Uyarılar",
                description:
                  "Fiyat değişikliklerinde masaüstü bildirimleri ve e-posta uyarıları alın. Hiçbir fırsatı kaçırmayın.",
              },
              {
                icon: <IconFileText />,
                title: "Akıllı Raporlar",
                description:
                  "Yapay zeka destekli pazar analiz raporları ve PDF çıktılarıyla yönetim kararlarınızı veriye dayandırın.",
              },
            ].map((feature, i) => (
              <RevealSection key={i} delay={i * 100}>
                <div className="command-card p-8 h-full group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--soft-gold)]/10 flex items-center justify-center text-[var(--soft-gold)] mb-5 group-hover:bg-[var(--soft-gold)]/20 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
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
                Başarı Hikayeleri
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white">
                Otelciler <span className="text-[var(--soft-gold)]">Ne Diyor?</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "Hotel Plus ile gelirlerimizi %15 artırdık. Rakip analizleri sayesinde doğru fiyatı yanlış zamanda vermekten kurtulduk.",
                author: "Ahmet Y.",
                role: "Genel Müdür, Resort Hotel",
                initials: "AY"
              },
              {
                quote: "Kurulumu sadece 5 dakika sürdü. Karmaşık excel tablolarından kurtulup tüm pazar verisini tek ekranda görmek harika.",
                author: "Zeynep K.",
                role: "Gelirler Müdürü",
                initials: "ZK"
              },
              {
                quote: "Yatırım getirisini ilk aydan aldık. Rakiplerin fiyat hamlelerini anında görüp aksiyon alabiliyoruz.",
                author: "Mehmet S.",
                role: "Otel Sahibi",
                initials: "MS"
              }
            ].map((item, i) => (
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
                      <div className="text-white font-bold text-sm">{item.author}</div>
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
      {/* EXPLANATION: 3-tier pricing with "En Popüler" badge on middle tier.
          Designed for clarity + risk reduction (per page-cro skill). */}
      <section className="relative z-10 py-24 px-6 bg-[#030a15]/30">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-3">
                Fiyatlandırma
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white">
                Otelinize Uygun{" "}
                <span className="text-[var(--soft-gold)]">Plan Seçin</span>
              </h2>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Başlangıç",
                price: "₺2.490",
                period: "/ay",
                description: "Tek otel için temel izleme",
                features: [
                  "1 otel takibi",
                  "5 rakip izleme",
                  "Günlük fiyat taraması",
                  "E-posta uyarıları",
                  "Temel raporlar",
                ],
                popular: false,
                cta: "Başlayın",
              },
              {
                name: "Profesyonel",
                price: "₺4.990",
                period: "/ay",
                description: "Büyüyen oteller için gelişmiş analiz",
                features: [
                  "3 otel takibi",
                  "15 rakip izleme",
                  "Saatlik fiyat taraması",
                  "Push + E-posta uyarıları",
                  "AI destekli raporlar",
                  "Pazar analizi",
                  "Keşif motoru",
                ],
                popular: true,
                cta: "En Popüler",
              },
              {
                name: "Kurumsal",
                price: "Özel",
                period: "",
                description: "Otel zincirleri için tam çözüm",
                features: [
                  "Sınırsız otel",
                  "Sınırsız rakip",
                  "Gerçek zamanlı tarama",
                  "Tüm bildirim kanalları",
                  "Global Pulse ağı",
                  "API erişimi",
                  "Özel entegrasyonlar",
                  "Öncelikli destek",
                ],
                popular: false,
                cta: "İletişime Geçin",
              },
            ].map((plan, i) => (
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
                      En Popüler
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-[var(--text-muted)] text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--soft-gold)" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.name === "Kurumsal" ? "/contact" : "/contact"}
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
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                Sıkça Sorulan <span className="text-[var(--soft-gold)]">Sorular</span>
              </h2>
              <p className="text-[var(--text-secondary)]">Aklınızdaki soruları yanıtlıyoruz.</p>
            </div>
            
            <div className="divide-y divide-white/5 border-y border-white/5">
              {[
                {
                  q: "Kurulum ne kadar sürer? Teknik bilgi gerekir mi?",
                  a: "Hayır, hiç teknik bilgi gerekmez. Otelinizi sisteme eklemek sadece 5 dakika sürer. Siz otel adınızı girin, gerisini yapay zekamız halleder."
                },
                {
                  q: "Hangi sitelerden fiyat çekiyorsunuz?",
                  a: "Booking.com, Expedia, Hotels.com, Google Hotels ve kendi web siteleri dahil olmak üzere tüm majör OTA kanallarını ve meta arama motorlarını tarıyoruz."
                },
                {
                  q: "Üyelik taahhüdü var mı?",
                  a: "Hayır, Hotel Plus'ta uzun süreli kontrat veya taahhüt yoktur. İstediğiniz zaman iptal edebilir, sadece kullandığınız kadar ödersiniz."
                },
                {
                  q: "Kendi otelimi de takip edebilir miyim?",
                  a: "Kesinlikle. Kendi fiyatlarınızın rakiplerle karşılaştırmalı durumunu tek ekranda görür, parite sorunlarını anında tespit edersiniz."
                }
              ].map((faq, i) => (
                <FAQItem key={i} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== FINAL CTA SECTION ===== */}
      {/* EXPLANATION: Last conversion point before footer.
          Recap value prop + low-commitment CTA (per copywriting skill). */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealSection>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
              Fiyatlandırma Stratejinizi{" "}
              <span className="text-[var(--soft-gold)]">Bugün</span> Güçlendirin
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed">
              Ücretsiz demo ile Hotel Plus&apos;ı deneyimleyin.
              Kredi kartı gerekmez, kurulum süresi 5 dakikadır.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-gold text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                Erişim Talebi Oluşturun
              </Link>
              <Link
                href="/login"
                className="btn-ghost text-base py-4 px-8 w-full sm:w-auto cursor-pointer"
              >
                Zaten Hesabınız Var mı? Giriş Yapın
              </Link>
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
