"use client";

import React, { lazy, Suspense } from "react";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import { Bell, Search, Calendar, EyeOff, LogOut, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useModalContext } from "@/components/ui/ModalContext";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import ModalLoading from "@/components/ui/ModalLoading";

// Modals
import AddHotelModal from "@/components/modals/AddHotelModal";
import ProfileModal from "@/components/modals/ProfileModal";
import SettingsModal from "@/components/modals/SettingsModal";
import ThemeToggle from "@/components/ui/ThemeToggle";

const ScanSessionModal = lazy(
  () => import("@/components/modals/ScanSessionModal"),
);
const AlertsModal = lazy(() => import("@/components/modals/AlertsModal"));
const EditHotelModal = lazy(() => import("@/components/modals/EditHotelModal"));
const SubscriptionModal = lazy(
  () => import("@/components/modals/SubscriptionModal"),
);
const HotelDetailsModal = lazy(
  () => import("@/components/modals/HotelDetailsModal"),
);
const IntradayStoryModal = lazy(
  () => import("@/components/modals/IntradayStoryModal"),
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMounted(true);
  }, []);
  const { t, locale, setLocale } = useI18n();
  const { userId, loading: authLoading } = useAuth();
  const {
    data,
    userSettings,
    profile,
    handleAddHotel,
    fetchData,
    updateSettings,
    setProfile,
  } = useDashboard(userId, t);

  const {
    isAddHotelOpen,
    setIsAddHotelOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isAlertsOpen,
    setIsAlertsOpen,
    isProfileOpen,
    setIsProfileOpen,
    isBillingOpen,
    setIsBillingOpen,
    isEditHotelOpen,
    setIsEditHotelOpen,
    hotelToEdit,
    setHotelToEdit,
    isSessionModalOpen,
    setIsSessionModalOpen,
    selectedSession,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    selectedHotelForDetails,
    reSearchName,
    setReSearchName,
    reSearchLocation,
    setReSearchLocation,
    isIntradayModalOpen,
    setIsIntradayModalOpen,
    selectedIntradayEvents,
    selectedIntradayHotelName,
  } = useModalContext();

  // Hide sidebar on login and admin pages
  const isLoginPage = pathname === "/login";
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");


  if (!mounted || authLoading) {
    if (isLoginPage || isAdminPage) return <>{children}</>;
    return null;
  }

  if (isLoginPage || isAdminPage) {
    return <>{children}</>;
  }

  // Map route to title
  const getPageTitle = () => {
    switch (pathname) {
      case "/":
      case "/dashboard":
        return "Rate Intelligence Grid";
      case "/parity-monitor":
        return "Inventory Control";
      case "/analysis":
        return "Market Analysis";
      case "/reports":
        return "Audit Reports";
      case "/admin":
        return "System Admin Control";
      default:
        return "Enterprise Core";
    }
  };

  const hotelCount =
    (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0);

  const handleTerminateImpersonation = async () => {
    try {
      await api.terminateImpersonation();
      window.location.href = "/admin"; // Redirect back to admin
    } catch (err) {
      console.error("Failed to terminate impersonation", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent transition-colors duration-500">
      {/* Ghost Mode Indicator */}
      <AnimatePresence>
        {profile?.is_impersonating && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
          >
            <div className="bg-red-500/90 backdrop-blur-md border-x border-b border-red-400/30 px-6 py-2 rounded-b-2xl shadow-[0_10px_40px_rgba(239,68,68,0.4)] flex items-center gap-6 pointer-events-auto group">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <EyeOff className="w-4 h-4 text-[var(--overlay-text)] animate-pulse" />
                  <div className="absolute inset-0 bg-white blur-lg opacity-50 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[var(--overlay-text)] uppercase tracking-[0.2em] leading-tight">
                    Ghost Mode Active
                  </span>
                  <span className="text-[9px] font-bold text-[var(--overlay-text)]/70 uppercase tracking-widest">
                    Impersonating: {profile?.display_name || profile?.email}
                  </span>
                </div>
              </div>

              <div className="h-6 w-[1px] bg-white/20" />

              <button
                onClick={handleTerminateImpersonation}
                className="flex items-center gap-2 bg-white text-red-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-[var(--overlay-text)] transition-all transform hover:scale-105 active:scale-95 shadow-xl"
              >
                <LogOut className="w-3 h-3" />
                Stop Session
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-24 border-b border-[var(--glass-border)] flex items-center justify-between px-10 bg-[var(--glass-bg)] backdrop-blur-3xl sticky top-0 z-30 transition-all duration-500 shadow-[var(--glass-shadow)]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-[var(--text-primary)] tracking-[-0.04em] uppercase transition-all duration-500 mb-0.5">
                {getPageTitle()}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse shadow-[0_0_8px_var(--soft-gold)]" />
                <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-[0.2em] opacity-70">Live Intelligence Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsAlertsOpen(true)}
                className="w-12 h-12 rounded-2xl border border-[var(--glass-border)] flex items-center justify-center bg-[var(--glass-bg-accent)] hover:bg-[var(--bg-accent)] transition-all relative group shadow-lg"
              >
                <Bell className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                {(data?.unread_alerts_count || 0) > 0 && (
                  <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-[var(--alert-red)] rounded-full border-2 border-[var(--deep-ocean)] shadow-[0_0_10px_var(--alert-red)]" />
                )}
              </button>

              <div className="h-10 w-[1px] bg-[var(--glass-border)] mx-2" />

              <ThemeToggle />

              <div className="h-10 w-[1px] bg-white/5 mx-2" />

              {/* Language Toggle */}
              <div className="flex bg-[var(--glass-bg-accent)] p-1.5 rounded-2xl border border-[var(--glass-border)] shadow-inner">
                <button
                  onClick={() => setLocale("en")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${locale === "en"
                    ? "bg-[var(--soft-gold)] text-[var(--overlay-text)] shadow-lg shadow-[var(--soft-gold-glow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLocale("tr")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${locale === "tr"
                    ? "bg-[var(--soft-gold)] text-[var(--overlay-text)] shadow-lg shadow-[var(--soft-gold-glow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  TR
                </button>
              </div>

              <div className="h-10 w-[1px] bg-[var(--glass-border)] mx-2" />

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end hidden lg:flex">
                  <span className="text-sm font-black text-[var(--text-primary)] tracking-tight transition-colors duration-500">
                    {profile?.display_name || "Enterprise User"}
                  </span>
                  <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-[0.2em] transition-colors duration-500 opacity-80">
                    {profile?.role === "admin"
                      ? "System Master"
                      : "Revenue Intelligence"}
                  </span>
                </div>
                <UserMenu
                  profile={profile}
                  hotelCount={hotelCount}
                  onOpenProfile={() => setIsProfileOpen(true)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenUpgrade={() => setIsBillingOpen(true)}
                  onOpenBilling={() => setIsBillingOpen(true)}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
          {/* Enhanced Background Effects */}
          <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[var(--soft-gold)]/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
          <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-[var(--alert-red)]/5 blur-[150px] rounded-full -z-10 pointer-events-none" />
          
          <div className="relative z-10 px-10 py-10">{children}</div>
        </main>
      </div>

      {/* Global Modals */}
      <Suspense fallback={<ModalLoading />}>
        <AddHotelModal
          isOpen={isAddHotelOpen}
          onClose={() => {
            setIsAddHotelOpen(false);
            setReSearchName("");
            setReSearchLocation("");
          }}
          onAdd={handleAddHotel}
          initialName={reSearchName}
          initialLocation={reSearchLocation}
          currentHotelCount={hotelCount}
          userPlan={profile?.plan_type || "trial"}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={userSettings}
          onSave={async (settings) => {
            await updateSettings(settings);
            setIsSettingsOpen(false);
          }}
        />

        <ScanSessionModal
          isOpen={isSessionModalOpen}
          onClose={() => setIsSessionModalOpen(false)}
          session={selectedSession}
        />


        {hotelToEdit && (
          <EditHotelModal
            isOpen={isEditHotelOpen}
            onClose={() => {
              setIsEditHotelOpen(false);
              setHotelToEdit(null);
            }}
            hotel={hotelToEdit}
            onUpdate={fetchData}
          />
        )}

        <AlertsModal
          isOpen={isAlertsOpen}
          onClose={() => setIsAlertsOpen(false)}
          userId={userId || ""}
          onUpdate={fetchData}
        />

        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userId={userId || ""}
          initialData={profile}
          onUpdate={(updated) => setProfile(updated)}
        />

        <SubscriptionModal
          isOpen={isBillingOpen}
          onClose={() => setIsBillingOpen(false)}
          currentPlan={profile?.plan_type || "trial"}
          onUpgrade={async (plan) => {
            // Plan upgrade logic
            setProfile({
              ...profile,
              plan_type: plan,
              subscription_status: "active",
            });
            setIsBillingOpen(false);
          }}
        />

        <HotelDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          hotel={selectedHotelForDetails}
          isEnterprise={
            profile?.role === "admin" ||
            profile?.plan_type?.toLowerCase() === "enterprise" ||
            profile?.plan_type?.toLowerCase() === "pro" ||
            profile?.plan_type?.toLowerCase() === "trial"
          }
          onUpgrade={() => {
            setIsDetailsModalOpen(false);
            setIsBillingOpen(true);
          }}
        />

        <IntradayStoryModal
          isOpen={isIntradayModalOpen}
          onClose={() => setIsIntradayModalOpen(false)}
          events={selectedIntradayEvents}
          hotelName={selectedIntradayHotelName}
        />
      </Suspense>
    </div>
  );
}
