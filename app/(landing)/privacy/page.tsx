/**
 * EXPLANATION: Privacy Policy Page (Gizlilik Politikası)
 * 
 * Provides compliance disclosure for hotel chains and enterprise auditors.
 * Dynamically switches language based on the global locale switcher ("en" vs "tr").
 * 
 * Adheres to:
 * - GDPR (Right to be Forgotten, Data Minimization, Hard Deletion)
 * - CCPA (Risk Assessments & Disclosure)
 * - ISO 27001 & SOC 2 type audit requirements
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

export default function PrivacyPage() {
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
                  UYUMLULUK & GÜVENLİK
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-[var(--overlay-text)] leading-[1.1] tracking-tight mb-4">
                  Gizlilik{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Politikası</span>
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
                    Genel Bakış ve Veri Minimizasyonu
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus, oteller için otonom fiyat ve rakip istihbaratı sağlayan bir B2B platformudur. Kamusal alanda yayınlanan otel oda fiyatları ve pazar dağılım verilerini analiz ederek çalışır.
                  </p>
                  <p className="text-sm">
                    <strong>Kişisel Veri Minimizasyonu:</strong> Platformumuz nihai tüketicilere (otel misafirlerine) ait hiçbir kredi kartı, ödeme, rezervasyon veya kimlik bilgisi (PII) <strong>işlemez, kaydetmez veya iletmez</strong>. Tüm fiyat verileri kamuya açık arama kaynaklarından toplanır.
                  </p>
                </div>

                {/* Section 2 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    Toplanan Veriler
                  </h2>
                  <p className="text-sm mb-4">
                    Platformun işletilmesi için yalnızca aşağıdaki sınırlı veri setleri toplanmaktadır:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>B2B Kullanıcı Profili:</strong> B2B kontrol paneline erişen otel yöneticilerinin ad soyad, iş e-postası, telefon numarası, otel adı ve unvan bilgileri (InsForge veritabanında güvenli bir şekilde saklanır).
                    </li>
                    <li>
                      <strong>Kamuya Açık Rekabet Verileri:</strong> Rakiplerinizin OTA kanallarındaki liste fiyatları, müsaitlik durumları, oda kategorileri ve kamuya açık misafir yorum skorları (web scraping entegrasyonu ile sağlanır).
                    </li>
                    <li>
                      <strong>Sistem Kayıtları (Loglar):</strong> Güvenlik denetimleri ve suistimali önlemek amacıyla kullanıcıların IP adresleri, tarayıcı bilgileri ve arayüz hareketleri.
                    </li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Satır Düzeyinde Güvenlik (RLS) ve Kiracı İzolasyonu
                  </h2>
                  <p className="text-sm">
                    HotelPlus, veri izolasyonunu sağlamak amacıyla PostgreSQL veritabanında katı bir **Row-Level Security (RLS)** protokolü uygular. Her B2B abonesi yalnızca kendi oteline ve izleme listesindeki otellere ait analizlere erişebilir. Verilerinizin diğer sistem kullanıcıları tarafından görüntülenmesi veya sızdırılması altyapı seviyesinde engellenmiştir.
                  </p>
                </div>

                {/* Section 4 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Veri Saklama ve İmha Politikası
                  </h2>
                  <p className="text-sm">
                    Veri minimizasyonu kapsamında, taramalar sonucu elde edilen ham log dosyaları <strong>7 gün sonra</strong> otomatik olarak özet analiz (rollup) verilerine dönüştürülür. Ham log kayıtları ise en geç <strong>30 gün içinde</strong> sistemimizden tamamen ve geri döndürülemez şekilde silinir (Hard Purge).
                  </p>
                </div>

                {/* Section 5 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    Kullanıcı Hakları (KVKK & GDPR / CCPA)
                  </h2>
                  <p className="text-sm mb-4">
                    Kullanıcılarımız KVKK, GDPR ve CCPA uyarınca aşağıdaki haklara sahiptir:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Erişim ve Bilgi Alma:</strong> Bizde kayıtlı olan profil verilerinizi dilediğiniz zaman kontrol panelinizden görüntüleyebilirsiniz.</li>
                    <li><strong>Kalıcı Silme (Right to be Forgotten):</strong> Hesabınızı kapatmak istediğinizde, profil bilgileriniz ve sisteme eklediğiniz tüm özel yapılandırmalar veritabanımızdan kalıcı olarak silinir (Soft delete değil, hard delete uygulanır).</li>
                    <li><strong>Veri Taşınabilirliği:</strong> Kayıtlı izleme ayarlarınızı ve fiyat geçmişinizi CSV/PDF olarak dışa aktarabilirsiniz.</li>
                  </ul>
                </div>

                {/* Section 6 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">06.</span>
                    Güvenlik Önlemleri
                  </h2>
                  <p className="text-sm">
                    Veri iletimi TLS 1.3 protokolü ile şifrelenir. Ayrıca platformumuz, veritabanı sorgu hataları veya sistem istisnaları oluştuğunda hassas hata mesajlarının dışarı sızmasını önleyen otomatik **hata maskeleme / temizleme (error scrubbing)** mekanizmasına sahiptir.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Gizlilik ve uyumluluk konularındaki sorularınız için:
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
                  COMPLIANCE & SECURITY
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-[var(--overlay-text)] leading-[1.1] tracking-tight mb-4">
                  Privacy{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Policy</span>
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
                    Overview & Data Minimization
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus is a B2B hotel rate intelligence, market pricing analysis, and competitive parity monitoring platform. It works by analyzing publicly available hotel room rates and market distribution data.
                  </p>
                  <p className="text-sm">
                    <strong>Zero Personal Data Footprint:</strong> Our platform **does not process, store, or transmit** credit card details, guest booking databases, or guest Personally Identifiable Information (PII). All pricing data is collected from public meta-search and OTA channels.
                  </p>
                </div>

                {/* Section 2 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    Information We Collect
                  </h2>
                  <p className="text-sm mb-4">
                    To operate the B2B SaaS platform, we only process the following limited categories of data:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>B2B Account Metadata:</strong> Names, business emails, phone numbers, hotel names, and job titles of registered hotel revenue managers (stored securely via InsForge).
                    </li>
                    <li>
                      <strong>Public Competitive Data:</strong> Competitor public pricing, rate types, room availability, and guest sentiment rating scores fetched via third-party scraping APIs.
                    </li>
                    <li>
                      <strong>System Logging:</strong> IP addresses, browser user agent strings, and click paths logs collected solely to maintain service integrity and prevent scraping abuse.
                    </li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Row-Level Security (RLS) & Tenant Isolation
                  </h2>
                  <p className="text-sm">
                    HotelPlus enforces strict **Row-Level Security (RLS)** policies at the database layer. This ensures tenant-level isolation: no customer can query, view, or modify rate configurations, logs, or credentials belonging to another hotel entity.
                  </p>
                </div>

                {/* Section 4 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Data Retention & Deletion
                  </h2>
                  <p className="text-sm">
                    In compliance with our data retention policy, raw scan logging payloads are summarized into trend rollups after **7 days**. All raw log footprints are permanently and irreversibly purged from our storage arrays within **30 days**.
                  </p>
                </div>

                {/* Section 5 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    User Rights (GDPR & CCPA / CPRA)
                  </h2>
                  <p className="text-sm mb-4">
                    B2B users are entitled to standard international privacy rights:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Right to Rectification:</strong> You may correct profile and watch list details in your Settings at any time.</li>
                    <li><strong>Right to Erasure (Right to be Forgotten):</strong> Upon requesting account closure, we perform a complete, hard deletion of your profile metadata and private watch lists from our database servers.</li>
                    <li><strong>Data Portability:</strong> You can export competitive price lists and log metrics to CSV/PDF formats at any time.</li>
                  </ul>
                </div>

                {/* Section 6 */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">06.</span>
                    Platform Security Controls
                  </h2>
                  <p className="text-sm">
                    All network traffic is encrypted via TLS 1.3 in transit. For error logging, our platform utilizes automated exception scrubbing algorithms, sanitizing raw database outputs on any 500 error response to prevent system vulnerability exposure.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    For privacy inquiries or compliance questions, please contact:
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
