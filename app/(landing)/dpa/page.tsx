/**
 * EXPLANATION: Data Processing Agreement (DPA) Page
 * 
 * Standard B2B DPA for hotel chain procurement and enterprise compliance.
 * Dynamically switches language based on the global locale switcher ("en" vs "tr").
 * 
 * Adheres to:
 * - GDPR Article 28 (Controller-Processor obligations)
 * - KVKK (Kişisel Verilerin Korunması Kanunu) – Turkish data protection law
 * - SOC 2 Type II audit requirements
 * - Hotel chain vendor onboarding questionnaires
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

export default function DpaPage() {
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
                  Veri İşleme{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Sözleşmesi (DPA)</span>
                </h1>
                <p className="text-sm text-[var(--text-muted)] mb-12">
                  Yürürlük Tarihi: Haziran 2026
                </p>
              </RevealSection>

              <RevealSection delay={100} className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
                {/* Section 1 — Tanımlar */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">01.</span>
                    Tanımlar
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>Veri Sorumlusu (Data Controller):</strong> Kişisel verilerin işlenme amaçlarını ve yöntemlerini belirleyen taraf — yani hizmet alan otel işletmesi ("Müşteri").
                    </li>
                    <li>
                      <strong>Veri İşleyen (Data Processor):</strong> Veri Sorumlusu adına kişisel verileri işleyen taraf — yani HotelPlus / Tripzy Teknoloji A.Ş.
                    </li>
                    <li>
                      <strong>Kişisel Veri:</strong> Kimliği belirli veya belirlenebilir bir gerçek kişiye ilişkin her türlü bilgi (ad-soyad, iş e-postası, IP adresi vb.).
                    </li>
                    <li>
                      <strong>Alt İşleyiciler (Sub-Processors):</strong> Veri İşleyen&apos;in, işleme faaliyetlerinin bir kısmını yürütmek üzere yetkilendirdiği üçüncü taraf hizmet sağlayıcılar.
                    </li>
                  </ul>
                </div>

                {/* Section 2 — İşleme Kapsamı */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    İşleme Kapsamı
                  </h2>
                  <p className="text-sm mb-4">
                    Veri İşleyen, yalnızca Müşteri&apos;nin B2B SaaS platformunu kullanması kapsamında aşağıdaki verileri işler:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>İşlenen Veri Kategorileri:</strong> B2B kullanıcı profilleri (ad, iş e-postası, telefon, unvan), sistem erişim logları (IP adresi, tarayıcı bilgisi) ve platformda oluşturulan yapılandırma verileri.</li>
                    <li><strong>İşleme Amacı:</strong> Otel fiyat istihbaratı, rekabet analizi ve B2B kontrol paneli hizmetlerinin sunulması.</li>
                    <li><strong>Hukuki Dayanak:</strong> Sözleşmenin ifası (KVKK Md. 5/2-c) ve meşru menfaat (GDPR Md. 6/1-f).</li>
                  </ul>
                </div>

                {/* Section 3 — Veri İşleyen Yükümlülükleri */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Veri İşleyen&apos;in Yükümlülükleri
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>Kişisel verileri yalnızca Veri Sorumlusu&apos;nun yazılı talimatlarına uygun olarak işler.</li>
                    <li>Verilere erişimi olan tüm personelin gizlilik yükümlülüğüne tabi olmasını sağlar.</li>
                    <li>Uygun teknik ve idari güvenlik önlemlerini uygular (bkz. Bölüm 06).</li>
                    <li>Alt işleyici ataması için Veri Sorumlusu&apos;nun önceden genel yazılı onayını alır.</li>
                    <li>İşlemenin niteliğini göz önünde bulundurarak, veri sahiplerinin haklarının yerine getirilmesinde Veri Sorumlusu&apos;na yardımcı olur.</li>
                    <li>Sözleşme sona erdiğinde, tüm kişisel verileri siler veya iade eder (Veri Sorumlusu&apos;nun tercihine bağlı olarak).</li>
                  </ul>
                </div>

                {/* Section 4 — Alt İşleyiciler */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Alt İşleyiciler (Sub-Processors)
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus, platform altyapısını işletmek üzere sınırlı sayıda üçüncü taraf alt işleyici kullanmaktadır. Güncel alt işleyici listesi talep üzerine paylaşılır.
                  </p>
                  <p className="text-sm">
                    Yeni bir alt işleyici atanması durumunda, Veri Sorumlusu en az <strong>30 gün</strong> önceden yazılı olarak bilgilendirilir. İtiraz hakkı saklıdır; geçerli bir itiraz halinde, etkilenen işleme faaliyetleri durdurulabilir veya sözleşme feshedilebilir.
                  </p>
                </div>

                {/* Section 5 — Veri Sahibi Hakları */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    Veri Sahibi Hakları (DSAR)
                  </h2>
                  <p className="text-sm mb-4">
                    Veri İşleyen, veri sahiplerinden gelen erişim, düzeltme, silme veya taşınabilirlik taleplerinin karşılanmasında Veri Sorumlusu&apos;na teknik destek sağlar:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Veri Dışa Aktarma:</strong> B2B kullanıcılar, profil ve izleme verilerini CSV/PDF formatında dışa aktarabilir.</li>
                    <li><strong>Kalıcı Silme:</strong> Hesap kapatma talebi üzerine, tüm kişisel veriler geri döndürülemez şekilde silinir (hard delete).</li>
                    <li><strong>Yanıt Süresi:</strong> DSAR talepleri en geç <strong>30 gün</strong> içinde yanıtlanır.</li>
                  </ul>
                </div>

                {/* Section 6 — Güvenlik Önlemleri */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">06.</span>
                    Güvenlik Önlemleri
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Aktarım Şifreleme:</strong> Tüm veri iletişimi TLS 1.3 protokolü ile şifrelenir.</li>
                    <li><strong>Erişim Kontrolü:</strong> Rol tabanlı erişim kontrolü (RBAC) ve PostgreSQL Row-Level Security (RLS) ile kiracı izolasyonu sağlanır.</li>
                    <li><strong>Denetim Kaydı:</strong> Tüm veri erişim ve değişiklik işlemleri otomatik olarak loglanır.</li>
                    <li><strong>Hata Maskeleme:</strong> Sistem istisnaları oluştuğunda hassas veriler otomatik olarak temizlenir (error scrubbing).</li>
                  </ul>
                </div>

                {/* Section 7 — Veri İhlali Bildirimi */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">07.</span>
                    Veri İhlali Bildirimi
                  </h2>
                  <p className="text-sm">
                    Kişisel verileri etkileyen bir güvenlik ihlali tespit edilmesi halinde, Veri İşleyen, olayı fark ettiği andan itibaren <strong>72 saat</strong> içinde Veri Sorumlusu&apos;nu yazılı olarak bilgilendirir. Bildirim; ihlalin niteliği, etkilenen veri kategorileri, tahmini veri sahibi sayısı ve alınan/planlanan düzeltici önlemleri içerir.
                  </p>
                </div>

                {/* Section 8 — Veri Transferleri */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">08.</span>
                    Veri Transferleri
                  </h2>
                  <p className="text-sm mb-4">
                    Tüm kişisel veriler, AB/AEA bölgesinde bulunan veri merkezlerinde barındırılmaktadır. Üçüncü ülkelere veri aktarımı gerektiğinde, GDPR Bölüm V kapsamındaki uygun güvenceler (Standart Sözleşme Maddeleri — SCC) uygulanır.
                  </p>
                  <p className="text-sm">
                    Türkiye&apos;deki işlemler için KVKK Md. 9 kapsamında Kişisel Verileri Koruma Kurulu kararlarına uyum sağlanır.
                  </p>
                </div>

                {/* Section 9 — Süre ve Fesih */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">09.</span>
                    Süre ve Fesih
                  </h2>
                  <p className="text-sm">
                    İşbu DPA, ana hizmet sözleşmesinin yürürlüğe girmesiyle birlikte geçerlilik kazanır ve hizmet sözleşmesi sona erene kadar yürürlükte kalır. Sözleşmenin feshi veya süresinin dolması halinde, Veri İşleyen tüm kişisel verileri <strong>30 gün</strong> içinde siler veya Veri Sorumlusu&apos;na iade eder; bu sürecin tamamlandığını yazılı olarak teyit eder.
                  </p>
                </div>

                {/* Section 10 — Uygulanacak Hukuk */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">10.</span>
                    Uygulanacak Hukuk
                  </h2>
                  <p className="text-sm">
                    İşbu Veri İşleme Sözleşmesi, <strong>Türkiye Cumhuriyeti</strong> hukukuna tabidir. KVKK (6698 sayılı Kişisel Verilerin Korunması Kanunu) birincil düzenleyici çerçeve olarak uygulanır. AEA bölgesinde bulunan veri sahiplerinin hakları bakımından GDPR (2016/679 sayılı Tüzük) hükümleri ayrıca geçerlidir. Uyuşmazlıklar, İstanbul Mahkemeleri ve İcra Daireleri&apos;nin münhasır yargı yetkisine tabidir.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    DPA ve uyumluluk konularındaki sorularınız için:
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
                  Data Processing{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Agreement (DPA)</span>
                </h1>
                <p className="text-sm text-[var(--text-muted)] mb-12">
                  Effective Date: June 2026
                </p>
              </RevealSection>

              <RevealSection delay={100} className="space-y-10 text-[var(--text-secondary)] leading-relaxed">
                {/* Section 1 — Definitions */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">01.</span>
                    Definitions
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <strong>Data Controller:</strong> The entity that determines the purposes and means of processing Personal Data — i.e., the hotel business subscribing to the platform (&quot;Customer&quot;).
                    </li>
                    <li>
                      <strong>Data Processor:</strong> The entity that processes Personal Data on behalf of the Data Controller — i.e., HotelPlus / Tripzy Teknoloji A.Ş.
                    </li>
                    <li>
                      <strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person (e.g., name, business email, IP address).
                    </li>
                    <li>
                      <strong>Sub-Processors:</strong> Third-party service providers engaged by the Data Processor to carry out specific processing activities.
                    </li>
                  </ul>
                </div>

                {/* Section 2 — Scope of Processing */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">02.</span>
                    Scope of Processing
                  </h2>
                  <p className="text-sm mb-4">
                    The Data Processor processes data solely in the context of the Customer&apos;s use of the B2B SaaS platform:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Data Categories:</strong> B2B user profiles (name, business email, phone, job title), system access logs (IP address, browser fingerprint), and platform configuration data.</li>
                    <li><strong>Purpose:</strong> Delivery of hotel rate intelligence, competitive analysis, and B2B dashboard services.</li>
                    <li><strong>Legal Basis:</strong> Performance of a contract (KVKK Art. 5/2-c) and legitimate interest (GDPR Art. 6/1-f).</li>
                  </ul>
                </div>

                {/* Section 3 — Obligations of the Data Processor */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">03.</span>
                    Obligations of the Data Processor
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>Process Personal Data only on documented instructions from the Data Controller.</li>
                    <li>Ensure that all personnel with access to Personal Data are bound by confidentiality obligations.</li>
                    <li>Implement appropriate technical and organizational security measures (see Section 06).</li>
                    <li>Obtain prior general written authorization from the Data Controller before engaging Sub-Processors.</li>
                    <li>Assist the Data Controller in fulfilling data subject rights requests, taking into account the nature of the processing.</li>
                    <li>Delete or return all Personal Data upon termination of the agreement, at the Data Controller&apos;s election.</li>
                  </ul>
                </div>

                {/* Section 4 — Sub-Processors */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">04.</span>
                    Sub-Processors
                  </h2>
                  <p className="text-sm mb-4">
                    HotelPlus uses a limited number of third-party sub-processors to operate the platform infrastructure. The current sub-processor list is available upon request.
                  </p>
                  <p className="text-sm">
                    Prior to engaging a new sub-processor, the Data Controller will be notified in writing at least <strong>30 days</strong> in advance. The Data Controller retains the right to object; upon a valid objection, the affected processing activities may be suspended or the agreement may be terminated.
                  </p>
                </div>

                {/* Section 5 — Data Subject Rights */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">05.</span>
                    Data Subject Rights (DSAR)
                  </h2>
                  <p className="text-sm mb-4">
                    The Data Processor provides technical assistance to the Data Controller in responding to data subject access, rectification, erasure, and portability requests:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Data Export:</strong> B2B users can export their profile and monitoring data in CSV/PDF format.</li>
                    <li><strong>Permanent Deletion:</strong> Upon account closure request, all Personal Data is irreversibly deleted (hard delete, not soft delete).</li>
                    <li><strong>Response Timeline:</strong> DSAR requests are fulfilled within <strong>30 days</strong>.</li>
                  </ul>
                </div>

                {/* Section 6 — Security Measures */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">06.</span>
                    Security Measures
                  </h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Encryption in Transit:</strong> All data transmissions are encrypted using TLS 1.3.</li>
                    <li><strong>Access Controls:</strong> Role-Based Access Control (RBAC) and PostgreSQL Row-Level Security (RLS) enforce tenant isolation.</li>
                    <li><strong>Audit Logging:</strong> All data access and modification events are automatically logged.</li>
                    <li><strong>Error Scrubbing:</strong> Automated exception scrubbing sanitizes sensitive data from error responses.</li>
                  </ul>
                </div>

                {/* Section 7 — Data Breach Notification */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">07.</span>
                    Data Breach Notification
                  </h2>
                  <p className="text-sm">
                    In the event of a security breach affecting Personal Data, the Data Processor shall notify the Data Controller in writing within <strong>72 hours</strong> of becoming aware of the breach. The notification shall include the nature of the breach, categories of data affected, approximate number of data subjects impacted, and corrective measures taken or proposed.
                  </p>
                </div>

                {/* Section 8 — Data Transfers */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">08.</span>
                    Data Transfers
                  </h2>
                  <p className="text-sm mb-4">
                    All Personal Data is hosted in data centers located within the EU/EEA. Where transfers to third countries are required, appropriate safeguards under GDPR Chapter V are applied, including Standard Contractual Clauses (SCCs).
                  </p>
                  <p className="text-sm">
                    For processing within Turkey, compliance with KVKK Article 9 and decisions of the Personal Data Protection Board (KVKK Kurulu) is maintained.
                  </p>
                </div>

                {/* Section 9 — Term and Termination */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">09.</span>
                    Term and Termination
                  </h2>
                  <p className="text-sm">
                    This DPA takes effect upon execution of the master service agreement and remains in force until the service agreement terminates. Upon termination or expiry, the Data Processor shall delete or return all Personal Data within <strong>30 days</strong> and provide written confirmation that the deletion has been completed.
                  </p>
                </div>

                {/* Section 10 — Governing Law */}
                <div className="command-card p-8">
                  <h2 className="text-xl font-bold text-[var(--overlay-text)] mb-4 flex items-center gap-3">
                    <span className="text-[var(--soft-gold)] font-mono">10.</span>
                    Governing Law
                  </h2>
                  <p className="text-sm">
                    This Data Processing Agreement is governed by the laws of the <strong>Republic of Turkey</strong>. KVKK (Law No. 6698 on the Protection of Personal Data) serves as the primary regulatory framework. For data subjects located in the EEA, GDPR (Regulation 2016/679) provisions apply additionally. Disputes are subject to the exclusive jurisdiction of the courts and enforcement offices of Istanbul, Turkey.
                  </p>
                </div>

                {/* Contact */}
                <div className="text-center pt-8 border-t border-[var(--overlay-border)]">
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    For DPA inquiries or compliance questions, please contact:
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
