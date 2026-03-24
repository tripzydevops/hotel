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
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="w-full">
          {skeleton || (
            <div className="glass-card p-6 h-32 animate-pulse flex flex-col gap-4">
              <div className="h-4 w-1/3 bg-white/10 rounded" />
              <div className="h-8 w-1/2 bg-white/10 rounded" />
              <div className="h-4 w-1/4 bg-white/10 rounded mt-auto" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
