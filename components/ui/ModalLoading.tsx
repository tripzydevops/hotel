"use client";

import { Loader2 } from "lucide-react";

export default function ModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean)] p-6 rounded-2xl border border-[var(--soft-gold)]/20 shadow-xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
        <Loader2 className="w-8 h-8 text-[var(--soft-gold)] animate-spin" />
        <p className="text-sm font-medium text-[var(--soft-gold)] animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
