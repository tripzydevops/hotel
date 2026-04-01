"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-between w-full h-10 px-3 py-2 rounded-xl bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] transition-all hover:border-[var(--soft-gold)] group"
      aria-label="Toggle Theme"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-5 h-5 flex items-center justify-center">
          <motion.div
            initial={false}
            animate={{
              rotate: theme === "dark" ? 0 : 90,
              opacity: theme === "dark" ? 1 : 0,
              scale: theme === "dark" ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="absolute"
          >
            <Moon className="w-4 h-4 text-[var(--soft-gold)]" />
          </motion.div>
          <motion.div
            initial={false}
            animate={{
              rotate: theme === "light" ? 0 : -90,
              opacity: theme === "light" ? 1 : 0,
              scale: theme === "light" ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="absolute"
          >
            <Sun className="w-4 h-4 text-amber-500" />
          </motion.div>
        </div>
        <span className="text-xs font-bold tracking-tight text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] capitalize">
          {theme === "dark" ? "Dark Mode" : "Light Mode"}
        </span>
      </div>

      <div className="w-8 h-4 rounded-full bg-[var(--deep-ocean)] relative p-0.5 border border-[var(--glass-border)]">
        <motion.div
          animate={{ x: theme === "dark" ? 0 : 16 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-3 h-3 rounded-full bg-[var(--soft-gold)] shadow-[0_0_10px_rgba(212,175,55,0.5)]"
        />
      </div>
    </button>
  );
}
