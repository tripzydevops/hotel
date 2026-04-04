"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { BarChart3, Calendar, Radar, HeartHandshake } from "lucide-react";
import { motion } from "framer-motion";

export default function AnalysisTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    {
      id: "overview",
      label: "Overview", // Fallback if translation missing
      key: "analysis.tabs.overview",
      href: "/analysis",
      icon: BarChart3,
      exact: true,
    },
    {
      id: "calendar",
      label: "Rate Calendar",
      key: "analysis.tabs.calendar",
      href: "/analysis/calendar",
      icon: Calendar,
    },
    {
      id: "discovery",
      label: "Discovery Engine",
      key: "analysis.tabs.discovery",
      href: "/analysis/discovery",
      icon: Radar,
    },
    {
      id: "sentiment",
      label: "Sentiment",
      key: "analysis.tabs.sentiment",
      href: "/analysis/sentiment",
      icon: HeartHandshake,
    },
  ];

  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = tab.exact 
          ? pathname === tab.href 
          : pathname?.startsWith(tab.href);
          
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="relative"
          >
            <div
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-wide
                ${
                  isActive
                    ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)] shadow-[0_0_15px_rgba(246,195,68,0.3)]"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[var(--deep-ocean)]" : "text-current"}`} />
              <span>{t(tab.key as any) || tab.label}</span>
            </div>
            
            {/* 
              EXPLANATION: Active Tab Indicator
              Visual reinforcement for the current active section in the analysis module.
            */}
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--soft-gold)]"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
