"use client";

import React from "react";
import Link from "next/link";
import { Bell, User } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function ParityHeader() {
  return (
    <header className="w-full h-24 border-b border-[var(--glass-border)] bg-[var(--deep-ocean)]/80 sticky top-0 z-50 backdrop-blur-xl transition-colors duration-500">
      <div className="max-w-[1440px] mx-auto px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-10 h-full">
          <div className="flex items-center gap-5">
            <div className="gold-border-logo-container h-16 w-16 shadow-2xl shadow-yellow-500/10 p-[1.5px] bg-[linear-gradient(135deg,#BF953F,#FCF6BA,#B38728,#FBF5B7,#AA771C)] rounded-xl transition-all">
              <div className="bg-[var(--deep-ocean)] rounded-[11px] flex items-center justify-center h-full w-full p-2 transition-colors duration-500">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="relative w-10 h-10">
                    <div className="absolute left-0 top-0 w-3 h-full bg-[#003366] rounded-sm"></div>
                    <div className="absolute right-0 top-0 w-3 h-full bg-[#003366] rounded-sm"></div>
                    <div className="absolute left-0 top-[42%] w-full h-2 bg-[#003366]"></div>
                    <div className="absolute left-[20%] bottom-0 flex items-end gap-[2px]">
                      <div className="w-1 h-3 bg-[#F6C344]"></div>
                      <div className="w-1 h-5 bg-[#F6C344]"></div>
                      <div className="w-1 h-7 bg-[#F6C344]"></div>
                    </div>
                    <div className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center">
                      <div className="absolute w-3.5 h-1 bg-[#F6C344] rounded-full"></div>
                      <div className="absolute w-1 h-3.5 bg-[#F6C344] rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-2xl tracking-tight text-[var(--text-primary)] leading-none transition-colors duration-500">
                Hotel Plus
              </span>
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#F6C344]/80 font-bold mt-1.5">
                Rate Parity
              </span>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-8 h-full">
            <Link
              className="text-sm font-semibold text-slate-400 hover:text-white transition-colors h-full flex items-center"
              href="/"
            >
              Dashboard
            </Link>
            <Link
              className="text-sm font-semibold text-[#F6C344] border-b-2 border-[#F6C344] h-full flex items-center"
              href="/parity-monitor"
            >
              Parity Monitor
            </Link>
            <Link
              className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors h-full flex items-center"
              href="#"
            >
              CompSet
            </Link>
            <Link
              className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors h-full flex items-center"
              href="#"
            >
              Distribution
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              System Status
            </span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
              Monitoring Live
            </span>
          </div>
          <ThemeToggle />
          <div className="w-10 h-10 rounded-xl border border-[var(--glass-border)] flex items-center justify-center bg-[var(--deep-ocean-accent)] cursor-pointer hover:border-[var(--soft-gold)]/50 transition-all duration-300">
            <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-[var(--soft-gold)]/20 p-0.5">
            <div className="w-full h-full rounded-full bg-[var(--deep-ocean-accent)] flex items-center justify-center overflow-hidden text-[var(--text-secondary)] transition-colors duration-500">
              <User className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
