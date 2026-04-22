"use client";

import { X, AlertTriangle, LogIn, RefreshCcw } from "lucide-react";

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: "login" | "retry";
  };
  onClose?: () => void;
}

export default function ErrorModal({
  isOpen,
  title,
  message,
  action,
  onClose,
}: ErrorModalProps) {
  if (!isOpen) return null;

  const IconComponent = action?.icon === "login" ? LogIn : RefreshCcw;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 px-4">
      <div className="relative w-full max-w-lg p-1">
        {/* Outer Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-[var(--soft-gold)]/20 to-orange-500/20 blur-2xl opacity-50" />
        
        <div className="premium-card relative bg-[#0a1224] border border-[var(--overlay-border)] p-8 shadow-2xl overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--soft-gold)]/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            {/* Header with Icon */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--overlay-text)] italic tracking-tight uppercase leading-none mb-1">
                  {title}
                </h2>
                <div className="h-[2px] w-12 bg-red-500/50 rounded-full" />
              </div>
              
              {onClose && (
                <button
                  onClick={onClose}
                  className="ml-auto p-2 hover:bg-white/5 rounded-full transition-colors group"
                >
                  <X className="w-5 h-5 text-[var(--overlay-text)]/30 group-hover:text-[var(--overlay-text)] transition-colors" />
                </button>
              )}
            </div>

            {/* Message Body */}
            <div className="mb-8">
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed font-medium">
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {action && (
                <button
                  onClick={action.onClick}
                  className="w-full btn-gold flex items-center justify-center gap-3 py-4 text-sm font-black uppercase tracking-widest group shadow-[0_10px_30px_rgba(212,175,55,0.1)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.2)] transition-all"
                >
                  <IconComponent className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{action.label}</span>
                </button>
              )}
              
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--overlay-text)]/30 hover:text-[var(--overlay-text)] transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
