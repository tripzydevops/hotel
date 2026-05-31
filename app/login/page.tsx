"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";
import { insforge } from "@/lib/insforge";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [emailForVerification, setEmailForVerification] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaUid, setMfaUid] = useState("");
  const [mfaCode, setMfaCode] = useState<string[]>(Array(6).fill(""));
  const [mfaResendSuccess, setMfaResendSuccess] = useState(false);


  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = isLogin 
        ? await insforge.auth.signInWithPassword({ email, password })
        : await insforge.auth.signUp({ email, password });

      setDebugInfo({
        baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        isLogin,
        email,
        result
      });

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error as any).message || "Auth failed";
        
        if (errorMsg.includes("pending administrator approval") || errorMsg.includes("403")) {
          setIsPendingApproval(true);
        } else {
          setError(errorMsg);
        }
        
        setIsLoading(false);
      } else {
        // [KAİZEN] Perform Profile Sanity Check
        try {
          const { api } = await import("@/lib/api");
          const profile = await api.getProfile();

          // Intercept administrative and enterprise accounts for MFA verification
          const adminEmails = [
            "admin@hotel.plus",
            "selcuk@rate-sentinel.com",
            "asknsezen@gmail.com",
            "askinsezen@gmail.com",
            "yusuf@tripzy.travel",
            "elif@tripzy.travel",
            "tripzydevops@gmail.com"
          ];
          const isSystemAdmin = email.endsWith("@hotel.plus") || adminEmails.includes(email.toLowerCase());
          const isProfileAdmin = profile?.role === "admin" || profile?.role === "market_admin" || profile?.role === "market admin";
          
          if (isProfileAdmin || isSystemAdmin) {
            const accessToken = (result as any).data?.accessToken;
            const uid = (result as any).data?.user?.id;
            if (accessToken) {
              setMfaToken(accessToken);
              setMfaUid(uid || "");
              setEmailForVerification(email);
              setIsMfaRequired(true);
              setMfaResendSuccess(false);
              setIsLoading(false);
              
              // Automatically trigger the email MFA verification code dispatch
              api.sendMfaCode(accessToken).catch((mfaSendErr) => {
                console.error("[Login] Automatic MFA dispatch failed:", mfaSendErr);
              });
              return;
            }
          }

          // ── Issue app-domain session cookie for server-side middleware auth ──
          // signInWithPassword returns { data: { accessToken, user }, error }.
          // We send the token to our Route Handler which verifies it server-to-
          // server with InsForge and issues an HttpOnly `hp_sess` cookie on the
          // app domain so the middleware can perform server-side auth checks.
          try {
            const accessToken = (result as any).data?.accessToken;
            const uid = (result as any).data?.user?.id;
            console.log("[Login] accessToken present:", !!accessToken, "| uid:", uid, "| email:", email);
            if (accessToken) {
              const sessRes = await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: accessToken, uid, email }),
              });
              console.log("[Login] /api/auth/session status:", sessRes.status);
              if (!sessRes.ok) {
                const errBody = await sessRes.text();
                console.error("[Login] Session cookie endpoint error:", sessRes.status, errBody);
              } else {
                console.log("[Login] hp_sess cookie should now be set ✓");
              }
            } else {
              console.error("[Login] FATAL: No accessToken in signInWithPassword result — hp_sess not set. result.data:", (result as any).data);
            }
          } catch (sessionErr) {
            console.error("[Login] Exception setting app session cookie:", sessionErr);
          }

          // Redirect to originally requested page if available
          const params = new URLSearchParams(window.location.search);
          const redirectTo = params.get("redirectTo") || "/dashboard";
          router.push(redirectTo);
        } catch (profileErr: any) {
          if (profileErr.message.includes("pending administrator approval") || profileErr.message.includes("403")) {
            setIsPendingApproval(true);
          } else {
            setError(profileErr.message);
          }
          setIsLoading(false);
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
      const result = await insforge.auth.verifyEmail({ 
        email: emailForVerification, 
        otp: otp
      });
      
      setDebugInfo({
        action: "verify",
        email: emailForVerification,
        result
      });

      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : (result.error as any).message || "Verification failed");
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
      const result = await insforge.auth.resendVerificationEmail({ 
        email: emailForVerification 
      });
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : (result.error as any).message || "Failed to resend code");
      } else {
        setError(null);
      }
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const handleMfaResend = async () => {
    setIsLoading(true);
    setError(null);
    setMfaResendSuccess(false);
    try {
      const { api } = await import("@/lib/api");
      const result = await api.sendMfaCode(mfaToken);
      if (result && result.success) {
        setMfaResendSuccess(true);
      } else {
        setError(result?.message || "Failed to resend MFA code.");
      }
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while resending the code.");
      setIsLoading(false);
    }
  };

  const handleMfaDigitChange = (index: number, val: string) => {
    const numericVal = val.replace(/[^0-9]/g, "");
    if (!numericVal && val !== "") return; // Allow empty to delete but block non-numeric

    const newCode = [...mfaCode];
    newCode[index] = numericVal.substring(numericVal.length - 1); // Get last digit typed
    setMfaCode(newCode);

    // Auto-tab to the next box if a digit was entered
    if (numericVal && index < 5) {
      const nextInput = document.getElementById(`mfa-digit-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleMfaDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace handling
    if (e.key === "Backspace") {
      const newCode = [...mfaCode];
      
      // If current is empty, clear the previous box and move focus back
      if (!newCode[index] && index > 0) {
        newCode[index - 1] = "";
        setMfaCode(newCode);
        const prevInput = document.getElementById(`mfa-digit-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      } else {
        newCode[index] = "";
        setMfaCode(newCode);
      }
    }
  };

  const handleMfaPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return; // Assert exactly 6 digits

    const digits = pastedData.split("");
    setMfaCode(digits);

    // Auto-focus the last field
    const lastInput = document.getElementById(`mfa-digit-5`) as HTMLInputElement;
    if (lastInput) {
      lastInput.focus();
    }
  };

  const handleMfaVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const fullCode = mfaCode.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      setIsLoading(false);
      return;
    }

    try {
      const { api } = await import("@/lib/api");
      
      // 1. Verify code on FastAPI backend
      const verifyRes = await api.verifyMfaCode(mfaToken, fullCode);
      
      if (!verifyRes || !verifyRes.success) {
        setError(verifyRes?.message || "Invalid passcode.");
        setIsLoading(false);
        return;
      }

      // 2. Code verified! Proceed to set the session cookie on Next.js domain
      const sessRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token: mfaToken, 
          uid: mfaUid, 
          email: emailForVerification 
        }),
      });

      if (!sessRes.ok) {
        const errText = await sessRes.text();
        setError(`Failed to establish session: ${errText}`);
        setIsLoading(false);
        return;
      }

      // 3. Complete dashboard entry redirect
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirectTo") || "/dashboard";
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during MFA verification");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)] px-4 relative overflow-hidden">
      {/* Cinematic Background Layers */}
      <div className="radial-glow" />
      <div className="bg-grain" />

      <div className="w-full max-w-lg card-blur p-12 shadow-2xl relative z-10 group rounded-[3rem] border border-[var(--overlay-border)]">
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
        {isPendingApproval ? (
          <div className="space-y-6 relative z-10 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-[var(--soft-gold)]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--soft-gold)]/20">
               <span className="text-4xl">⏳</span>
            </div>
            <h2 className="text-2xl font-black text-[var(--overlay-text)] italic">
               {t("auth.pendingTitle") || "Approval Pending"}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
               {t("auth.pendingMessage") || "Your account has been created successfully. For security reasons, a system administrator must manually verify your identity before you can access the dashboard. Please check back soon or contact support if this takes longer than 24 hours."}
            </p>
            <button
               onClick={() => {
                 setIsPendingApproval(false);
                 setIsLogin(true);
                 setError(null);
               }}
               className="w-full py-4 bg-white/5 border border-[var(--overlay-border)] rounded-xl text-[var(--soft-gold)] font-bold hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
            >
               {t("auth.backToLogin") || "Back to Login"}
            </button>
          </div>
        ) : isVerifying ? (
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
                className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-xl py-4 px-4 text-[var(--overlay-text)] text-4xl text-center font-black tracking-[0.5em] placeholder:text-[var(--overlay-text)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
                placeholder="000000"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
                <button
                disabled={isLoading}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${isLoading
                    ? "bg-white/10 text-[var(--text-muted)] cursor-not-allowed"
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
                    className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--overlay-text)] transition-colors"
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
        ) : isMfaRequired ? (
          <form onSubmit={handleMfaVerify} className="space-y-6 relative z-10 text-center animate-in fade-in zoom-in duration-500">
            <div className="space-y-2">
              <label
                htmlFor="mfa-digit-0"
                className="block text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest"
              >
                {t("auth.mfaTitle") || "Security Verification"}
              </label>
              <p className="text-[var(--text-secondary)] text-xs mb-4">
                {t("auth.mfaDescriptionEmail") || "Please enter the 6-digit verification code sent to your registered email address."}
              </p>
              
              {mfaResendSuccess && (
                <div className="mb-4 text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 py-2.5 px-3 rounded-xl animate-pulse">
                  ✓ {t("auth.mfaResendSuccess") || "A new security code has been sent to your email address."}
                </div>
              )}
              
              <div className="flex justify-center gap-2" dir="ltr">
                {Array(6).fill(0).map((_, idx) => (
                  <input
                    key={idx}
                    id={`mfa-digit-${idx}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={mfaCode[idx] || ""}
                    onChange={(e) => handleMfaDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleMfaDigitKeyDown(idx, e)}
                    onPaste={handleMfaPaste}
                    className="w-12 h-14 bg-white/5 border border-[var(--overlay-border)] rounded-xl text-center text-2xl font-black text-[var(--overlay-text)] focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)] focus:border-transparent transition-all hover:bg-white/10"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                disabled={isLoading}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${isLoading
                  ? "bg-white/10 text-[var(--text-muted)] cursor-not-allowed"
                  : "bg-gradient-to-r from-[var(--soft-gold)] to-[#e6b800] text-[var(--deep-ocean)] hover:shadow-[var(--soft-gold)]/20"
                  }`}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-[var(--deep-ocean)]/30 border-t-[var(--deep-ocean)] rounded-full animate-spin" />
                ) : (
                  t("auth.mfaVerifyButton") || "Verify Passcode"
                )}
              </button>
              
              <button
                type="button"
                onClick={handleMfaResend}
                disabled={isLoading}
                className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--overlay-text)] transition-colors mt-2"
              >
                {t("auth.mfaResendButton") || "Resend Code via Email"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMfaRequired(false);
                  setMfaCode(Array(6).fill(""));
                  setMfaResendSuccess(false);
                  setError(null);
                }}
                disabled={isLoading}
                className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest hover:text-[var(--overlay-text)] transition-colors mt-1"
              >
                {t("auth.backToLogin") || "Back to Login"}
              </button>
            </div>
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
                className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-xl py-3 px-4 text-[var(--overlay-text)] placeholder:text-[var(--overlay-text)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
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
                className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-xl py-3 px-4 text-[var(--overlay-text)] placeholder:text-[var(--overlay-text)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all hover:bg-white/10"
                placeholder="••••••••"
              />
            </div>

            <button
              disabled={isLoading}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${isLoading
                ? "bg-white/10 text-[var(--text-muted)] cursor-not-allowed"
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
        {!isVerifying && !isPendingApproval && !isMfaRequired && (
          <div className="mt-8 pt-6 border-t border-[var(--overlay-border)] text-center relative z-10">
            <p className="text-[var(--text-muted)] text-sm mb-4">
              {isLogin ? t("auth.newToPlatform") : t("auth.alreadyHaveAccount")}
            </p>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-[var(--soft-gold)] font-bold hover:text-[var(--overlay-text)] transition-colors flex items-center gap-2 mx-auto decoration-2 underline-offset-4 hover:underline"
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
          className="mt-6 block mx-auto text-[11px] px-4 py-1.5 rounded-full border border-[var(--overlay-border)] text-[var(--text-muted)] hover:text-[var(--overlay-text)]/80 hover:bg-white/5 transition-all"
        >
          {showDebug ? "Hide Debug System" : "Show Debug System"}
        </button>

        {showDebug && (
          <div className="mt-4 p-4 bg-black/80 rounded-xl border border-[var(--overlay-border)] text-[10px] font-mono text-green-400 overflow-auto max-h-48">
            <pre>{JSON.stringify({
              config: {
                // KAİZEN: Show actual client baseUrl instead of potentially stale env var
                baseUrl: typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_URL,
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
