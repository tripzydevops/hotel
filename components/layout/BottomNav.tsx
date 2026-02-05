"use client";

import { Home, Bell, PlusCircle, Settings, User } from "lucide-react";
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[var(--deep-ocean)]/80 backdrop-blur-xl border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex flex-col items-center justify-center gap-1 flex-1 text-[var(--soft-gold)]"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium uppercase tracking-tighter">
            {t("common.dashboard")}
          </span>
        </button>

        <button
          onClick={onOpenAlerts}
          className="flex flex-col items-center justify-center gap-1 flex-1 text-[var(--text-secondary)] relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
          )}
          <span className="text-[10px] font-medium uppercase tracking-tighter">
            {t("common.alerts")}
          </span>
        </button>

        <button
          onClick={onOpenAddHotel}
          className="flex flex-col items-center justify-center -mt-8 bg-[var(--soft-gold)] text-[var(--deep-ocean)] w-14 h-14 rounded-full shadow-lg shadow-[var(--soft-gold)]/20 border-4 border-[var(--deep-ocean)]"
        >
          <PlusCircle className="w-7 h-7" />
        </button>

        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center gap-1 flex-1 text-[var(--text-secondary)]"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium uppercase tracking-tighter">
            {t("common.settings")}
          </span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center gap-1 flex-1 text-[var(--text-secondary)]"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium uppercase tracking-tighter">
            {t("common.profile")}
          </span>
        </button>
      </div>
    </nav>
  );
}
