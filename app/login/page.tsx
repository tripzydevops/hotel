"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";
import { useInsforge } from "@insforge/nextjs";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { t } = useI18n();
  const { signIn, signUp, verifyEmail, resendVerificationEmail } = useInsforge();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailForVerification, setEmailForVerification] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      setDebugInfo({
        baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        isLogin,
        email,
        result
      });

      if ('error' in result && result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error as any).message || "Auth failed";
        setError(errorMsg);
        
        // If user already exists during signup, they might be unverified
        if (!isLogin && errorMsg.includes("already exists")) {
            setEmailForVerification(email);
        }
        
        setIsLoading(false);
      } else {
        // Success
        if (!isLogin && (result as any).requireEmailVerification) {
          setEmailForVerification(email);
          setIsVerifying(true);
          setIsLoading(false);
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const otp = formData.get("otp") as string;

    try {
      const result = await verifyEmail(otp, emailForVerification);
      
      setDebugInfo({
        action: "verify",
        email: emailForVerification,
        result
      });

      if ('error' in result) {
        setError(result.error || "Verification failed");
        setIsLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await resendVerificationEmail(emailForVerification);
      if (!result || !result.success) {
        setError(result?.message || "Failed to resend code");
      } else {
        // Show success briefly or just clear error
        setError(null);
      }
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
          <HotelPlusLogo variant="login" />
          <p className="text-[var(--text-secondary)] mt-3 text-sm text-center font-medium uppercase tracking-widest opacity-80">
            {isVerifying 
              ? t("auth.verifySubtitle").replace("{email}", emailForVerification) 
              : isLogin ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm animate-shake">
            <p className="font-bold mb-1 flex items-center gap-2">
              ⚠️ {t("auth.errorTitle")}
            </p>
            {error}
            {!isVerifying && !isLogin && error.includes("already exists") && (
                <button 
                    onClick={() => setIsVerifying(true)}
                    className="block mt-2 text-[var(--soft-gold)] font-bold underline"
                >
                    {t("auth.alreadyHaveCode")}
                </button>
            )}
          </div>
        )}

        {/* Form Section */}
        {isVerifying ? (
          <form onSubmit={handleVerify} className="space-y-6 relative z-10 text-center">
            <div className="space-y-2">
              <label
                htmlFor="otp"
                className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest"
              >
                {t("auth.otpLabel")}
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                maxLength={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white text-4xl text-center font-black tracking-[0.5em] placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
                placeholder="000000"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
                <button
                disabled={isLoading}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${isLoading
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] hover:shadow-[var(--soft-gold)]/20"
                    }`}
                >
                {isLoading ? (
                    <div className="w-6 h-6 border-3 border-[var(--deep-ocean)]/30 border-t-[var(--deep-ocean)] rounded-full animate-spin" />
                ) : (
                    t("auth.verifyButton")
                )}
                </button>
                
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-white/40 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                >
                    {t("auth.resendButton")}
                </button>
            </div>

            <button
                type="button"
                onClick={() => {
                    setIsVerifying(false);
                    setError(null);
                }}
                className="text-[var(--soft-gold)] text-xs font-bold mt-4"
            >
                {t("auth.wrongEmail")}
            </button>
          </form>
        ) : (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(new FormData(e.currentTarget));
            }} 
            className="space-y-5 relative z-10"
          >
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
                defaultValue={emailForVerification}
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
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${isLoading
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
        )}

        {/* Toggle Section */}
        {!isVerifying && (
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
        )}

        <div className="mt-8 text-center text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold opacity-50">
          {t("auth.protectedText")}
        </div>

        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="mt-6 block mx-auto text-[11px] px-4 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
        >
          {showDebug ? "Hide Debug System" : "Show Debug System"}
        </button>

        {showDebug && (
          <div className="mt-4 p-4 bg-black/80 rounded-xl border border-white/10 text-[10px] font-mono text-green-400 overflow-auto max-h-48">
            <pre>{JSON.stringify({
              config: {
                baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing'
              },
              lastResult: debugInfo,
              isVerifying,
              emailForVerification
            }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
