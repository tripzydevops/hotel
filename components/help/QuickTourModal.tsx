"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LayoutGrid,
  Eye,
  Calendar,
  ShieldAlert,
  Crown,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface QuickTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuide?: (guideId: string) => void;
}

const TOUR_SLIDES_EN = [
  {
    step: 1,
    title: "1. The Target Hotel Benchmark",
    subtitle: "Your hotel direct rate is the sovereign anchor of rate parity",
    guideId: "getting-started",
    icon: Crown,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Architecture Core",
    content:
      "On HotelPlus, your hotel is marked with a gold crown as the Target Property. All undercut alerts, price variances, and parity penalties are calculated in real-time against this benchmark rate.",
    proTip: "Make sure your direct website URL and official rates are configured so undercutting OTAs are immediately detected.",
  },
  {
    step: 2,
    title: "2. Google Hotels Live Price Grid",
    subtitle: "Catching rogue OTAs and tracking competitor pricing velocity",
    guideId: "dashboard-grid",
    icon: LayoutGrid,
    iconColor: "text-blue-400",
    badge: "Daily Monitoring",
    content:
      "The Live Dashboard displays your hotel alongside your competitor basket. Red badges highlight OTAs selling rooms below your direct rate. Click 'Quick Scan' to trigger an immediate live crawl through our DataForSEO pipeline.",
    proTip: "A quick scan updates all live rates in under 15 seconds across Google Hotels, Booking.com, and Expedia.",
  },
  {
    step: 3,
    title: "3. 6-Tab Deep Forensic Inspection",
    subtitle: "Audit room tiers, OTA offers, sentiment, and amenities",
    guideId: "hotel-inspection",
    icon: Eye,
    iconColor: "text-emerald-400",
    badge: "Forensics",
    content:
      "Clicking 'View Details' on any hotel reveals the 6-tab modal. Compare side-by-side OTA offers, normalized room catalogs (Deluxe vs Deluxe), AI review sentiment themes, and amenity sets.",
    proTip: "Sort the 'Offers' tab to isolate which specific intermediary is leaking unauthorized promotions.",
  },
  {
    step: 4,
    title: "4. 30-Day Rate Calendar & AI Discovery",
    subtitle: "Forward rate heatmaps and vector semantic rival matchmaking",
    guideId: "rate-calendar",
    icon: Calendar,
    iconColor: "text-purple-400",
    badge: "Yield & Strategy",
    content:
      "The Rate Calendar plots forward rates across 30 days to catch demand spikes. Meanwhile, the Discovery Engine uses pgvector & Gemini embeddings to discover non-obvious rival hotels based on guest personas.",
    proTip: "Vector discovery finds hotels competing for your exact guest segment, not just nearby hotels.",
  },
  {
    step: 5,
    title: "5. Autonomous Copilot (Gemini 3.1 Pro)",
    subtitle: "Conversational revenue reasoning with zero hallucinations",
    guideId: "copilot-ai",
    icon: Sparkles,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Next-Gen AI",
    content:
      "Ask questions in natural language: 'Why did Competitor A drop rates by 15%?' The Copilot analyzes competitor Pricing DNA (Volume Leader vs Yield Seeker) and recommends tactical rate adjustments.",
    proTip: "Click prompt chips inside the Copilot drawer for instant morning market digests.",
  },
];

const TOUR_SLIDES_TR = [
  {
    step: 1,
    title: "1. Hedef Otel Referansı",
    subtitle: "Doğrudan otel fiyatınız parite hesaplamalarının bağımsız temelidir",
    guideId: "getting-started",
    icon: Crown,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Temel Mimari",
    content:
      "HotelPlus'ta oteliniz altın taç simgesiyle Hedef Tesis olarak işaretlenir. Tüm fiyat kırma uyarıları, fiyat sapmaları ve parite cezaları bu referans fiyat baz alınarak gerçek zamanlı hesaplanır.",
    proTip: "Fiyat kıran OTA'ların anında yakalanması için doğrudan web sitesi bağlantınızın ve resmi fiyatlarınızın tanımlı olduğundan emin olun.",
  },
  {
    step: 2,
    title: "2. Google Hotels Canlı Fiyat Tablosu",
    subtitle: "Kural dışı OTA'ları yakalama ve rakip fiyat hızını izleme",
    guideId: "dashboard-grid",
    icon: LayoutGrid,
    iconColor: "text-blue-400",
    badge: "Günlük Takip",
    content:
      "Canlı Panel otelinizi rakip sepetinizle yan yana gösterir. Kırmızı rozetler doğrudan fiyatınızın altında oda satan OTA'ları vurgular. DataForSEO hattımız üzerinden anlık tarama başlatmak için 'Hızlı Tarama'ya tıklayın.",
    proTip: "Hızlı tarama; Google Hotels, Booking.com ve Expedia üzerindeki tüm fiyatları 15 saniyenin altında günceller.",
  },
  {
    step: 3,
    title: "3. 6-Sekmeli Derinlemesine İnceleme",
    subtitle: "Oda tipleri, OTA teklifleri, misafir duygusu ve olanakları denetleyin",
    guideId: "hotel-inspection",
    icon: Eye,
    iconColor: "text-emerald-400",
    badge: "Adli Analiz",
    content:
      "Herhangi bir otelde 'Detayları Gör'e tıklamak 6 sekmeli modalı açar. Yan yana OTA tekliflerini, normalize edilmiş oda kataloglarını (Deluxe vs Deluxe), yapay zeka yorum analizini ve olanakları karşılaştırın.",
    proTip: "Hangi aracı kurumun yetkisiz promosyon sızdırdığını bulmak için 'Teklifler' sekmesini sıralayın.",
  },
  {
    step: 4,
    title: "4. 30-Günlük Fiyat Takvimi & Yapay Zeka Keşfi",
    subtitle: "İleriye dönük fiyat ısı haritaları ve vektörel rakip eşleştirme",
    guideId: "rate-calendar",
    icon: Calendar,
    iconColor: "text-purple-400",
    badge: "Gelir & Strateji",
    content:
      "Fiyat Takvimi talep sıçramalarını yakalamak için 30 günlük fiyatları haritalandırır. Keşif Motoru ise pgvector ve Gemini gömmelerini kullanarak misafir profillerine göre gözden kaçan rakipleri bulur.",
    proTip: "Vektörel keşif sadece yakın otelleri değil, tam olarak aynı misafir segmentine hitap eden rakipleri bulur.",
  },
  {
    step: 5,
    title: "5. Otonom Copilot (Gemini 3.1 Pro)",
    subtitle: "Sıfır halüsinasyonla doğal dilde gelir muhakemesi",
    guideId: "copilot-ai",
    icon: Sparkles,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Yeni Nesil AI",
    content:
      "Doğal dilde sorular sorun: 'Rakip A gelecek hafta sonu fiyatları neden %15 düşürdü?' Copilot rakip Fiyatlandırma DNA'sını analiz eder ve taktiksel fiyat düzeltmeleri önerir.",
    proTip: "Anlık sabah piyasa özetleri için Copilot çekmecesindeki hazır soru çiplerine tıklayın.",
  },
];

export default function QuickTourModal({
  isOpen,
  onClose,
  onSelectGuide,
}: QuickTourModalProps) {
  const { locale } = useI18n();
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  if (!isOpen) return null;

  const slides = locale === "tr" ? TOUR_SLIDES_TR : TOUR_SLIDES_EN;
  const currentSlide = slides[currentSlideIndex] || slides[0];
  const IconComponent = currentSlide.icon;

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0A1629] border border-[var(--soft-gold)]/30 rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        >
          {/* Top Progress bar */}
          <div className="h-1 bg-white/10 w-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--soft-gold)]"
              animate={{
                width: `${((currentSlideIndex + 1) / slides.length) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 sm:pt-5 pb-2 sm:pb-3">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-2.5 sm:px-3 py-1 rounded-full border border-[var(--soft-gold)]/20">
              {locale === "tr" ? "Tanıtım" : "Onboarding"} • {locale === "tr" ? "Adım" : "Step"} {currentSlideIndex + 1} / {slides.length}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Slide Content */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide.step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${currentSlide.iconColor}`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                      {currentSlide.badge}
                    </span>
                    <h3 className="text-xl font-black text-white">{currentSlide.title}</h3>
                  </div>
                </div>

                <p className="text-sm font-semibold text-[var(--soft-gold)]">
                  {currentSlide.subtitle}
                </p>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentSlide.content}
                </p>

                {/* Pro Tip Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    <strong>{locale === "tr" ? "Önemli İpucu:" : "Pro Tip:"}</strong> {currentSlide.proTip}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 bg-[#07101E] border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
                className="p-2 rounded-xl text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 transition-colors"
                title={locale === "tr" ? "Önceki" : "Previous"}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlideIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentSlideIndex === i
                        ? "bg-[var(--soft-gold)] w-6"
                        : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSelectGuide && (
                <button
                  onClick={() => {
                    onSelectGuide(currentSlide.guideId);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/10 transition-colors flex items-center gap-1"
                >
                  {locale === "tr" ? "Rehberi Oku" : "Read Full Guide"} <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-[var(--soft-gold)] text-black font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-1 shadow-lg"
              >
                {currentSlideIndex === slides.length - 1
                  ? locale === "tr"
                    ? "Turu Tamamla"
                    : "Finish Tour"
                  : locale === "tr"
                  ? "Sonraki Adım"
                  : "Next Step"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
