/**
 * EXPLANATION: Contact Page (İletişim) with Demo Request Form
 * 
 * This is a key conversion page. The form captures demo requests
 * with minimal friction (Name, Email, Hotel Name, Message).
 * 
 * Per copywriting skill: "Low commitment CTA" — asking for a demo,
 * not a payment or signup. Per CRO skill: minimal form fields
 * to reduce friction.
 */
"use client";

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

export default function ContactPage() {
  const [formState, setFormState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hotelName: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("sending");

    /* EXPLANATION: In production, this would POST to /api/demo-request
       which triggers an email notification via the NotifierAgent.
       For now, we simulate success after a short delay. */
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setFormState("sent");
      setFormData({ name: "", email: "", hotelName: "", message: "" });
    } catch {
      setFormState("error");
    }
  };

  const inputClasses =
    "w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/8 text-sm";

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[var(--deep-ocean)]" />
        <div className="absolute inset-0 opacity-20" style={{
          background: `radial-gradient(ellipse 60% 40% at 70% 30%, rgba(212,175,55,0.08) 0%, transparent 50%)`,
        }} />
        <div className="bg-grain" />
      </div>

      {/* Content */}
      <section className="relative z-10 pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* Left: Info */}
            <div>
              <RevealSection>
                <p className="text-[var(--soft-gold)] text-sm font-bold uppercase tracking-[0.3em] mb-4">
                  İletişim
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
                  Demo{" "}
                  <span className="text-[var(--soft-gold)] gold-glow-text">Talep Edin</span>
                </h1>
                <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-10">
                  Hotel Plus&apos;ı otelinize özel bir demo ile tanıyın. Ekibimiz 
                  24 saat içinde sizinle iletişime geçecektir.
                </p>
              </RevealSection>

              <RevealSection delay={200}>
                <div className="space-y-6">
                  {[
                    {
                      icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      ),
                      label: "E-posta",
                      value: "info@hotelplus.com.tr",
                    },
                    {
                      icon: (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      ),
                      label: "Adres",
                      value: "Balıkesir, Türkiye",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-0.5">
                          {item.label}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RevealSection>
            </div>

            {/* Right: Form */}
            <RevealSection delay={100}>
              <div className="command-card p-8">
                {formState === "sent" ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Talebiniz Alındı!
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Ekibimiz en kısa sürede sizinle iletişime geçecektir.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="name" className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2 ml-1">
                        Ad Soyad
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClasses}
                        placeholder="Adınız Soyadınız"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2 ml-1">
                        E-posta
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={inputClasses}
                        placeholder="ornek@oteliniz.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="hotel" className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2 ml-1">
                        Otel Adı
                      </label>
                      <input
                        id="hotel"
                        type="text"
                        required
                        value={formData.hotelName}
                        onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                        className={inputClasses}
                        placeholder="Otelinizin adı"
                      />
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2 ml-1">
                        Mesaj (Opsiyonel)
                      </label>
                      <textarea
                        id="message"
                        rows={3}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className={`${inputClasses} resize-none`}
                        placeholder="Varsa özel talepleriniz..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={formState === "sending"}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-base transition-all cursor-pointer ${
                        formState === "sending"
                          ? "bg-white/10 text-white/40 cursor-not-allowed"
                          : "btn-gold"
                      }`}
                    >
                      {formState === "sending" ? (
                        <div className="w-5 h-5 border-2 border-[var(--deep-ocean)]/30 border-t-[var(--deep-ocean)] rounded-full animate-spin" />
                      ) : (
                        "Demo Talep Edin"
                      )}
                    </button>
                    {formState === "error" && (
                      <p className="text-sm text-red-400 text-center">
                        Bir hata oluştu. Lütfen tekrar deneyin.
                      </p>
                    )}
                  </form>
                )}
              </div>
            </RevealSection>
          </div>
        </div>
      </section>
    </div>
  );
}
