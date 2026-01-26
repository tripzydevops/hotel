"use client";

import { useState } from "react";
import { login, signup } from "./actions";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);

    const result = isLogin ? await login(formData) : await signup(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)] px-4">
      <div className="w-full max-w-md bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--soft-gold)]/10 rounded-full blur-3xl group-hover:bg-[var(--soft-gold)]/20 transition-all duration-700" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center mb-4 shadow-lg shadow-[var(--soft-gold)]/20 animate-float">
            <span className="text-[var(--deep-ocean)] font-bold text-3xl">
              H
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Hotel Plus{" "}
            <span className="text-[var(--soft-gold)]">Rate Sentinel</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm text-center">
            {isLogin ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm animate-shake">
            <p className="font-bold mb-1 flex items-center gap-2">
              ⚠️ {t("auth.errorTitle")}
            </p>
            {error}
          </div>
        )}

        {/* Form Section */}
        <form action={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest ml-1"
            >
              {t("auth.emailLabel")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest ml-1"
            >
              {t("auth.passwordLabel")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
              placeholder="••••••••"
            />
          </div>

          <button
            disabled={isLoading}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${
              isLoading
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] hover:shadow-[var(--soft-gold)]/20"
            }`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-3 border-[var(--deep-ocean)]/30 border-t-[var(--deep-ocean)] rounded-full animate-spin" />
            ) : isLogin ? (
              t("auth.signInButton")
            ) : (
              t("auth.signUpButton")
            )}
          </button>
        </form>

        {/* Toggle Section */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center relative z-10">
          <p className="text-[var(--text-muted)] text-sm mb-4">
            {isLogin ? t("auth.newToPlatform") : t("auth.alreadyHaveAccount")}
          </p>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-[var(--soft-gold)] font-bold hover:text-white transition-colors flex items-center gap-2 mx-auto decoration-2 underline-offset-4 hover:underline"
          >
            {isLogin ? t("auth.requestAccess") : t("auth.backToLogin")}
          </button>
        </div>

        <div className="mt-8 text-center text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold opacity-50">
          {t("auth.protectedText")}
        </div>
      </div>
    </div>
  );
}
