"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center gap-2 p-1 rounded-full bg-[var(--bg-accent)] border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/30 transition-all group overflow-hidden h-10 w-20 shadow-inner"
      aria-label="Toggle Theme"
    >
      {/* Sliding Background */}
      <motion.div
        initial={false}
        animate={{
          x: theme === "dark" ? 0 : 40,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute inset-y-1.5 left-1.5 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--soft-gold)] to-[#b49020] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
      />

      {/* Icons */}
      <div className="relative z-10 flex items-center justify-between w-full px-2">
        <div className="flex items-center justify-center w-8 h-8">
          <Moon
            className={`w-3.5 h-3.5 transition-colors duration-300 ${
              theme === "dark" ? "text-white" : "text-[var(--text-muted)]"
            }`}
          />
        </div>
        <div className="flex items-center justify-center w-8 h-8">
          <Sun
            className={`w-4 h-4 transition-colors duration-300 ${
              theme === "light" ? "text-white" : "text-[var(--text-muted)]"
            }`}
          />
        </div>
      </div>

      {/* Subtle Glow on Hover */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--soft-gold)] to-transparent opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}
