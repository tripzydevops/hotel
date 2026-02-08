"use client";

import Image from "next/image";
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)] px-4 relative overflow-hidden">
      {/* Cinematic Background Layers */}
      <div className="radial-glow" />
      <div className="bg-grain" />

      <div className="w-full max-w-lg card-blur p-12 shadow-2xl relative z-10 group rounded-[3rem] border border-white/5">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--soft-gold)]/10 rounded-full blur-3xl group-hover:bg-[var(--soft-gold)]/20 transition-all duration-1000" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000" />

        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="relative group/logo">
            <div className="absolute inset-0 bg-[var(--soft-gold)]/20 blur-2xl group-hover/logo:blur-3xl transition-all duration-500 rounded-full" />
            <div className="w-24 h-24 relative z-10 metallic-gold p-[1.5px] rounded-2xl animate-float transition-transform group-hover:scale-110 duration-500">
              <div className="bg-[#050B18] rounded-[15px] flex items-center justify-center h-full w-full p-3">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="relative w-full h-full flex items-end justify-center gap-[2px] pb-1">
                    <div className="w-2 h-[40%] bg-[var(--soft-gold)] rounded-t-sm animate-pulse shadow-[0_0_10px_rgba(246,195,68,0.3)]"></div>
                    <div className="w-2 h-[70%] bg-[var(--soft-gold)] rounded-t-sm shadow-[0_0_10px_rgba(246,195,68,0.3)]"></div>
                    <div className="w-2 h-[100%] bg-[var(--soft-gold)] rounded-t-sm shadow-[0_0_10px_rgba(246,195,68,0.3)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter text-center">
            Hotel Rate <span className="text-[var(--soft-gold)]">Sentinel</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-3 text-sm text-center font-medium uppercase tracking-widest opacity-80">
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
