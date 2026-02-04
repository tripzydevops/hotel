"use client";

import React from "react";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
}

const StatCard = ({ label, value, icon: Icon }: StatCardProps) => (
  <div className="glass-card p-6 border border-white/10 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 flex items-center justify-center shrink-0">
      <Icon className="w-6 h-6 text-[var(--soft-gold)]" />
    </div>
    <div>
      <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-white">
        {value?.toLocaleString() || 0}
      </p>
    </div>
  </div>
);

export default StatCard;
