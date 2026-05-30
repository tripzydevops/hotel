/**
 * EXPLANATION: Glassmorphic Cookie Consent Banner
 * 
 * Compliance overlay that respects user privacy preferences (GDPR/CCPA/KVKK).
 * Dynamically switches languages based on active i18n locale switcher.
 * Uses the Deep Ocean + Soft Gold design system tokens for styling.
 */
"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Shield, X } from "lucide-react";

export default function CookieConsent() {
  const { t } = useI18n();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem("hotelplus_cookie_consent");
      if (!consent) {
        // Show banner after a slight delay to allow layout animations to settle
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleAccept = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hotelplus_cookie_consent", "accepted");
      setShowBanner(false);
    }
  };

  const handleDecline = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hotelplus_cookie_consent", "declined");
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="glass-card p-6 border border-[var(--overlay-border)] bg-[rgba(5,11,24,0.85)] backdrop-blur-md rounded-2xl shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => setShowBanner(false)}
          className="absolute top-4 right-4 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--overlay-text)] hover:bg-white/5 transition-all cursor-pointer"
          aria-label="Close cookie consent banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-4">
          {/* Icon Column */}
          <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center text-[var(--soft-gold)]">
            <Shield className="w-5 h-5" />
          </div>

          {/* Content Column */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-[var(--overlay-text)] uppercase tracking-wider mb-1">
                {t("common.cookieConsentTitle")}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t("common.cookieConsentText")}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                onClick={handleAccept}
                className="btn-gold text-xs py-2 px-4 rounded-lg font-bold transition-all text-center flex-1 cursor-pointer"
              >
                {t("common.cookieAccept")}
              </button>
              <button
                onClick={handleDecline}
                className="btn-ghost text-xs py-2 px-4 rounded-lg border border-[var(--overlay-border)] hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--overlay-text)] transition-all text-center flex-1 cursor-pointer"
              >
                {t("common.cookieDecline")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
