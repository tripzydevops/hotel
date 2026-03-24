"use client";

import { ReactNode } from "react";
import { LucideIcon, Ghost } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  iconClassName?: string;
}

export default function EmptyState({
  title,
  description,
  icon: Icon = Ghost,
  action,
  className = "",
  iconClassName = "text-[var(--text-muted)]",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-2xl border border-white/5 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Icon className={`w-6 h-6 ${iconClassName}`} />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
