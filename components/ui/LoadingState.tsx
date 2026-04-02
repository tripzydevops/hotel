"use client";

import { ReactNode } from "react";

interface LoadingStateProps {
  rows?: number;
  className?: string;
  skeleton?: ReactNode;
}

export default function LoadingState({
  rows = 3,
  className = "",
  skeleton,
}: LoadingStateProps) {
  return (
    <div className={`grid gap-6 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="w-full relative overflow-hidden group">
          {skeleton || (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-8 rounded-2xl h-44 animate-pulse flex flex-col gap-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite] pointer-events-none" />
              
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/[0.03]" />
                <div className="h-4 w-1/3 bg-white/[0.05] rounded-full" />
              </div>
              
              <div className="space-y-3">
                <div className="h-8 w-2/3 bg-white/[0.07] rounded-lg" />
                <div className="h-3 w-1/4 bg-white/[0.03] rounded-full" />
              </div>
              
              <div className="mt-auto flex justify-between items-center">
                <div className="h-5 w-20 bg-white/[0.05] rounded-md" />
                <div className="h-2 w-12 bg-white/[0.03] rounded-full" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
