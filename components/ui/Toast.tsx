"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Zap,
  ShieldAlert,
} from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({
  id,
  type,
  message,
  duration = 4000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 500);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 500);
  };

  const icons = {
    success: <Zap className="w-5 h-5 text-[var(--gold-primary)]" />,
    error: <ShieldAlert className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-[var(--gold-primary)]" />,
  };

  const bgStyles = {
    success:
      "bg-black/80 border-[var(--gold-primary)]/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]",
    error:
      "bg-red-500/10 border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]",
    info: "bg-black/80 border-[var(--gold-primary)]/20 shadow-[0_0_30px_rgba(212,175,55,0.1)]",
  };

  return (
    <div
      className={`
        flex items-center gap-4 p-5 rounded-2xl border backdrop-blur-2xl
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform
        ${bgStyles[type]}
        ${isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-90"}
      `}
      style={{ fontFamily: "var(--font-main)" }}
      role="alert"
    >
      <div className="flex-shrink-0 relative">
        <div
          className={`absolute inset-0 blur-lg opacity-40 ${type === "error" ? "bg-red-500" : "bg-[var(--gold-primary)]"}`}
        />
        <div className="relative">{icons[type]}</div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-[10px] font-black uppercase tracking-[0.3em] ${type === "error" ? "text-red-400" : "text-[var(--gold-primary)]"}`}
        >
          {type === "success"
            ? "Neural_Confirmed"
            : type === "error"
              ? "Kernel_Fault"
              : "System_Signal"}
        </span>
        <p className="text-sm font-bold text-white leading-snug">{message}</p>
      </div>
      <button
        onClick={handleClose}
        className="ml-6 flex-shrink-0 p-2 rounded-xl hover:bg-white/5 text-[var(--text-muted)] hover:text-white transition-all transform hover:rotate-90"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
