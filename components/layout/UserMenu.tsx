"use client";

import React, { useState, useEffect } from "react";
import { User, LogOut, Settings, CreditCard, ChevronDown, Sparkles } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { motion, AnimatePresence } from "framer-motion";

interface UserMenuProps {
  profile?: any;
  hotelCount?: number;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenUpgrade?: () => void;
  onOpenBilling?: () => void;
}

export default function UserMenu({
  profile: initialProfile,
  onOpenProfile,
  onOpenSettings,
  onOpenUpgrade,
  onOpenBilling,
}: UserMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(initialProfile);
  const [prevInitialProfile, setPrevInitialProfile] = useState<any>(initialProfile);

  if (initialProfile !== prevInitialProfile) {
    setProfile(initialProfile);
    setPrevInitialProfile(initialProfile);
  }

  const handleLogout = async () => {
    await insforge.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 pl-2 pr-4 py-2 rounded-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] hover:bg-[var(--bg-accent)] hover:border-[var(--soft-gold)]/30 transition-all active:scale-95 shadow-xl"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--soft-gold)] to-[var(--soft-gold-dim)] p-0.5 flex items-center justify-center overflow-hidden shadow-[var(--soft-gold-glow)]">
          <div className="w-full h-full rounded-full bg-[var(--deep-ocean)] flex items-center justify-center text-[var(--text-primary)]">
            <User className="w-5 h-5" />
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none mb-1">
            {profile?.display_name?.split(' ')[0] || "User"}
          </span>
          <div className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-[var(--soft-gold)]" />
            <span className="text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-widest leading-none opacity-80">Pro Plan</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-all ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 mt-4 w-64 glass-card border border-[var(--glass-border)] rounded-[2rem] shadow-[var(--glass-shadow)] z-50 py-3 overflow-hidden"
            >
              {/* Dropdown Header */}
              <div className="px-6 py-4 bg-[var(--glass-bg-accent)] border-b border-[var(--glass-border)] mb-2">
                <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest truncate mb-1">
                  {profile?.display_name || "Enterprise User"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-bold truncate tracking-tight uppercase">
                  {profile?.email || "hotel-plus-core"}
                </p>
              </div>

              <div className="px-2 space-y-1">
                <button
                  onClick={() => {
                    onOpenProfile?.();
                    setIsOpen(false);
                  }}
                  className="w-full group flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--soft-gold)]/10 transition-all"
                >
                  <div className="p-2 bg-[var(--glass-bg-accent)] rounded-xl group-hover:bg-[var(--soft-gold)]/20 group-hover:text-[var(--soft-gold)] transition-colors">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  Account Profile
                </button>
                <button
                  onClick={() => {
                    onOpenSettings?.();
                    setIsOpen(false);
                  }}
                  className="w-full group flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--soft-gold)]/10 transition-all"
                >
                  <div className="p-2 bg-[var(--glass-bg-accent)] rounded-xl group-hover:bg-[var(--soft-gold)]/20 group-hover:text-[var(--soft-gold)] transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  System Settings
                </button>
                <button
                  onClick={() => {
                    onOpenBilling?.() || onOpenUpgrade?.();
                    setIsOpen(false);
                  }}
                  className="w-full group flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--soft-gold)]/10 transition-all"
                >
                  <div className="p-2 bg-[var(--glass-bg-accent)] rounded-xl group-hover:bg-[var(--soft-gold)]/20 group-hover:text-[var(--soft-gold)] transition-colors">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  Subscription
                </button>
              </div>

              <div className="h-[1px] bg-[var(--glass-border)] mx-6 my-3" />

              <div className="px-2">
                <button
                  onClick={handleLogout}
                  className="w-full group flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <div className="p-2 bg-rose-500/5 rounded-xl group-hover:bg-rose-500/20 transition-colors">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
