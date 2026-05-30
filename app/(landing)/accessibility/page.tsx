/**
 * EXPLANATION: Accessibility Statement Page (Erişilebilirlik Beyanı)
 * 
 * Provides compliance disclosure for accessibility standards (WCAG 2.1 Level AA).
 * Dynamically switches language based on the global locale switcher ("en" vs "tr").
 * 
 * Adheres to:
 * - WCAG 2.1 Level AA
 * - Section 508 / EN 301 549 requirements
 * - ISO/IEC 40500 standards
 */
"use client";

import { useI18n } from "@/lib/i18n";
import { useRef, useEffect, useState } from "react";

/* ===== SCROLL REVEAL HOOK ===== */
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

export default function AccessibilityPage() {
  const { locale } = useI18n();

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.08) 0%, transparent 50%),
                       radial-gradient(ellipse 50% 50% at 80% 80%, rgba(59,130,246,0.05) 0%, transparent 50%)`,
        }} />
        <div className="bg-grain" />
      </div>

      {/* Content Container */}
      <section className="relative z-10 pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          {locale === "tr" ? (
            /* ================= TR VERSION ================= */
            <div>
              <RevealSection>
                <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-4">
                  ERİŞİLEBİLİRLİK TAAHHÜDÜ
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-[var(--overlay-text)] leading-[1.1] tracking-tight mb-4">
                  Erişilebilirlik{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Beyanı</span>
                </h1>
                <p className="text-sm text-[var(--text-muted)] mb-12">
                  Son Güncelleme: 30 Mayıs 2026
                </p>
              </RevealSection>

              <RevealSection delay={100} className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
                {/* Section 1 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">01.</span>
                    Erişilebilirlik Vizyonumuz ve Standartlar
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus (Tripzy), platformumuzu engelli bireyler de dahil olmak üzere herkes için erişilebilir kılmaya kararlıdır. Web içeriğimizin tüm kullanıcılar için kullanılabilirliğini artırmak amacıyla sürekli olarak kullanıcı deneyimini iyileştiriyor ve ilgili erişilebilirlik standartlarını uyguluyoruz.
                  </p>
                  <p className="text-sm">
                    <strong>WCAG Uyum Hedefi:</strong> Platformumuz, W3C Web İçeriği Erişilebilirlik Kılavuz İlkeleri (WCAG) 2.1 Seviye AA standartlarına büyük ölçüde uyum sağlamak üzere tasarlanmıştır.
                  </p>
                </div>

                {/* Section 2 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    Desteklenen Erişilebilirlik Özellikleri
                  </h2>
                  <p className="text-sm mb-4">
                    Kullanıcı deneyimini kolaylaştırmak amacıyla arayüzlerimizde aşağıdaki yapısal çözümler uygulanmıştır:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>Klavye Navigasyonu:</strong> Tüm etkileşimli bileşenler (menüler, formlar, butonlar) fare kullanmadan, yalnızca standart `Tab` ve yön tuşları ile kontrol edilebilir şekilde tasarlanmıştır.
                    </li>
                    <li>
                      <strong>Semantik HTML Yapısı:</strong> Ekran okuyucu cihazların içeriği doğru bir şekilde yorumlayabilmesi için uygun HTML5 etiket hiyerarşisi (main, nav, section, h1-h6) kullanılmaktadır.
                    </li>
                    <li>
                      <strong>Yeterli Renk Kontrastı:</strong> Metinler ile arka plan renkleri arasındaki kontrast oranı, WCAG AA standartlarında belirlenen minimum oranları (4.5:1) karşılayacak şekilde tasarlanmıştır.
                    </li>
                    <li>
                      <strong>Görsel Alternatifleri:</strong> Platformdaki tüm anlamlı görseller ve grafikler için açıklayıcı alternatif metinler (alt niteliği) sağlanmaktadır.
                    </li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Tarayıcı ve Yardımcı Teknoloji Uyumluluğu
                  </h2>
                  <p className="text-sm">
                    Arayüzümüz, modern web tarayıcıları ve JAWS, NVDA, VoiceOver gibi yaygın ekran okuyucu yardımcı teknolojiler ile uyumlu çalışacak şekilde test edilmiştir. Sayfa yapısı, tarayıcı yakınlaştırma özellikleri (%200'e kadar) kullanıldığında düzen bozulması yaşamayacak şekilde esnek (responsive) tasarlanmıştır.
                  </p>
                </div>

                {/* Section 4 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Değerlendirme Yöntemleri
                  </h2>
                  <p className="text-sm">
                    Erişilebilirlik durumunu izlemek ve iyileştirmek için hem otomatik analiz araçları (Lighthouse, axe DevTools) hem de manuel klavye ve ekran okuyucu testleri düzenli aralıklarla gerçekleştirilmektedir. Arayüz güncellemelerimizde erişilebilirlik denetimleri süreçlerimizin bir parçasıdır.
                  </p>
                </div>

                {/* Section 5 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    İstisnalar ve Kısıtlamalar
                  </h2>
                  <p className="text-sm">
                    Fiyat istihbarat panellerinde yer alan bazı çok boyutlu dinamik fiyat trend grafikleri ve harita görselleştirmeleri, doğası gereği ekran okuyucular tarafından tamamen seslendirilemeyebilir. Bu gibi durumlarda, grafiklerin alt kısımlarında alternatif veri tabloları veya metin özetleri sunulmaya gayret edilmektedir.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Erişilebilirlik ile ilgili geri bildirimleriniz veya karşılaştığınız engeller için:
                  </p>
                  <p className="text-base font-bold text-[var(--soft-gold)]">
                    info@hotelplus.com.tr
                  </p>
                </div>
              </RevealSection>
            </div>
          ) : (
            /* ================= EN VERSION ================= */
            <div>
              <RevealSection>
                <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-4">
                  ACCESSIBILITY COMMITMENT
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-[var(--overlay-text)] leading-[1.1] tracking-tight mb-4">
                  Accessibility{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Statement</span>
                </h1>
                <p className="text-sm text-[var(--text-muted)] mb-12">
                  Last Updated: May 30, 2026
                </p>
              </RevealSection>

              <RevealSection delay={100} className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
                {/* Section 1 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">01.</span>
                    Our Vision and Standards
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus (Tripzy) is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone, and applying the relevant accessibility standards to make our platform intuitive and inclusive.
                  </p>
                  <p className="text-sm">
                    <strong>WCAG Target:</strong> Our software is built to conform to the World Wide Web Consortium (W3C) Web Content Accessibility Guidelines (WCAG) 2.1 Level AA specifications.
                  </p>
                </div>

                {/* Section 2 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    Supported Accessibility Features
                  </h2>
                  <p className="text-sm mb-4">
                    To facilitate ease of use, we incorporate several design patterns and coding structures:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>Keyboard Navigation:</strong> All interactive controls (menus, drop downs, search fields, buttons) are operable using a standard keyboard interface (`Tab` focusable and arrow-navigable).
                    </li>
                    <li>
                      <strong>Semantic Markup:</strong> We maintain strict HTML5 structural hierarchy, allowing assistive screen reader devices to easily scan, read, and interpret the content.
                    </li>
                    <li>
                      <strong>Contrast Compliance:</strong> Text color and background combinations are carefully selected to exceed the minimum WCAG contrast ratio (4.5:1).
                    </li>
                    <li>
                      <strong>Alt Text & ARIA Attributes:</strong> Descriptive tags are placed on key UI elements and informative graphics to ensure non-visual context is communicated.
                    </li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Browser and Screen Reader Compatibility
                  </h2>
                  <p className="text-sm">
                    The platform is designed to be compatible with modern web browsers and major assistive technologies, including NVDA, JAWS, and VoiceOver. Layouts scale responsively to accommodate system-level text magnification and browser zoom settings up to 200% without loss of functionality.
                  </p>
                </div>

                {/* Section 4 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Assessment Methodology
                  </h2>
                  <p className="text-sm">
                    We evaluate the accessibility of HotelPlus through a combination of automated scanning tools (axe DevTools, Lighthouse) and routine manual tests involving keyboard-only and screen reader navigation flows during major design updates.
                  </p>
                </div>

                {/* Section 5 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    Exemptions and Visual Limitations
                  </h2>
                  <p className="text-sm">
                    Certain complex multi-dimensional rate charts, real-time analytics graphs, and interactive map interfaces may have visual limitations for screen reader users. Where feasible, we provide raw tabular data views and text summaries to ensure alternative access to the underlying metrics.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    If you encounter any accessibility barriers or have feedback on how we can improve usability:
                  </p>
                  <p className="text-base font-bold text-[var(--soft-gold)]">
                    info@hotelplus.com.tr
                  </p>
                </div>
              </RevealSection>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
