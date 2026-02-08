"use client";

import React, { useState, useEffect } from "react";
import { User, LogOut, Settings, CreditCard, ChevronDown } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { api } from "@/lib/api";

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
  hotelCount,
  onOpenProfile,
  onOpenSettings,
  onOpenUpgrade,
  onOpenBilling,
}: UserMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(initialProfile);
  const supabase = createClient();

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full border-2 border-[#F6C344]/20 p-0.5 hover:border-[#F6C344]/50 transition-all active:scale-95"
      >
        <div className="w-full h-full rounded-full bg-[#142541] flex items-center justify-center overflow-hidden text-slate-300">
          <User className="w-6 h-6" />
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-3 w-56 bg-[#0A1629] border border-white/10 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-white/5 mb-2">
              <p className="text-xs font-black text-white uppercase tracking-tighter truncate">
                {profile?.full_name || "Enterprise User"}
              </p>
              <p className="text-[10px] text-slate-500 font-bold truncate">
                {profile?.email || "hotel-plus-core"}
              </p>
            </div>

            <button
              onClick={() => {
                onOpenSettings?.();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              Settings
            </button>
            <button
              onClick={() => {
                onOpenBilling?.() || onOpenUpgrade?.();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <CreditCard className="w-4 h-4 text-slate-500" />
              Subscription
            </button>

            <div className="h-[1px] bg-white/5 mx-2 my-2" />

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 flex items-center gap-3 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
