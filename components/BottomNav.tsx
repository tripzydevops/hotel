"use client";

import {
  Home,
  Bell,
  PlusCircle,
  Settings,
  User,
  Command,
  Target,
  Activity,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BottomNavProps {
  onOpenAddHotel: () => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
}

export default function BottomNav({
  onOpenAddHotel,
  onOpenAlerts,
  onOpenSettings,
  onOpenProfile,
  unreadCount = 0,
}: BottomNavProps) {
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/60 backdrop-blur-3xl border-t border-white/5 pb-6">
      <div className="flex items-center justify-around h-20 px-4">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex flex-col items-center justify-center gap-2 flex-1 text-[var(--gold-primary)] group"
        >
          <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">
            {t("common.dashboard")}
          </span>
        </button>

        <button
          onClick={onOpenAlerts}
          className="flex flex-col items-center justify-center gap-2 flex-1 text-white/40 group relative"
        >
          <div className="relative">
            <Bell className="w-6 h-6 group-hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
            )}
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">
            {t("common.alerts")}
          </span>
        </button>

        <div className="flex-1 flex justify-center -mt-12">
          <button
            onClick={onOpenAddHotel}
            className="flex items-center justify-center bg-[var(--gold-gradient)] text-black w-16 h-16 rounded-[2rem] shadow-[0_15px_30px_rgba(212,175,55,0.3)] border-4 border-black group active:scale-90 transition-all"
          >
            <PlusCircle className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center gap-2 flex-1 text-white/40 group"
        >
          <Settings className="w-6 h-6 group-hover:text-white transition-colors group-hover:rotate-45 transition-transform" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">
            {t("common.settings")}
          </span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center gap-2 flex-1 text-white/40 group"
        >
          <User className="w-6 h-6 group-hover:text-white transition-colors" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">
            {t("common.profile")}
          </span>
        </button>
      </div>
    </nav>
  );
}
