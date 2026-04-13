"use client";

import { Loader2, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

interface ScanStatusIndicatorProps {
  status: "idle" | "active" | "completed";
  count?: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

/**
 * Real-time indicator for price discovery tasks
 */
export function ScanStatusIndicator({ 
  status, 
  count = 0, 
  showLabel = true,
  size = "md"
}: ScanStatusIndicatorProps) {
  const { t } = useI18n();

  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1.5";

  return (
    <AnimatePresence mode="wait">
      {status === "active" && (
        <motion.div
           key="active"
           initial={{ opacity: 0, scale: 0.9, y: 5 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.9, y: -5 }}
           className={`flex items-center gap-2 ${padding} rounded-full bg-[var(--deep-ocean)]/40 border-2 border-[var(--soft-gold)]/40 text-[var(--soft-gold)] shadow-[0_0_15px_rgba(234,179,8,0.2)] group cursor-default backdrop-blur-md`}
        >
          <div className="relative">
            <Loader2 className={`${iconSize} animate-spin`} />
            <motion.div 
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 1.5, repeat: Infinity }}
               className="absolute inset-0 bg-[var(--soft-gold)] blur-[8px] opacity-20"
            />
          </div>
          
          {showLabel && (
            <span className={`${textSize} font-black uppercase tracking-widest whitespace-nowrap`}>
              {count > 0 ? `${count} Active Scans` : "Price Discovery Active"}
            </span>
          )}

          <div className="flex gap-0.5">
            <motion.div 
               animate={{ scale: [1, 1.3, 1] }}
               transition={{ duration: 1, repeat: Infinity, delay: 0 }}
               className="w-1 h-1 rounded-full bg-[var(--soft-gold)]"
            />
            <motion.div 
               animate={{ scale: [1, 1.3, 1] }}
               transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
               className="w-1 h-1 rounded-full bg-[var(--soft-gold)]"
            />
            <motion.div 
               animate={{ scale: [1, 1.3, 1] }}
               transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
               className="w-1 h-1 rounded-full bg-[var(--soft-gold)]"
            />
          </div>
        </motion.div>
      )}

      {status === "completed" && (
        <motion.div
           key="completed"
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0 }}
           className={`flex items-center gap-2 ${padding} rounded-full bg-[var(--optimal-green)]/20 border-2 border-[var(--optimal-green)]/40 text-[var(--optimal-green)] backdrop-blur-md`}
        >
          <CheckCircle2 className={iconSize} />
          {showLabel && (
            <span className={`${textSize} font-black uppercase tracking-widest`}>
              Data Updated
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
