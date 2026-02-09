"use client";

import React, { lazy, Suspense } from "react";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import { Bell, Search, Calendar } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useModalContext } from "@/components/ui/ModalContext";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import ModalLoading from "@/components/ui/ModalLoading";

// Modals
import AddHotelModal from "@/components/modals/AddHotelModal";
import ProfileModal from "@/components/modals/ProfileModal";
import SettingsModal from "@/components/modals/SettingsModal";

const ScanSessionModal = lazy(
  () => import("@/components/modals/ScanSessionModal"),
);
const AlertsModal = lazy(() => import("@/components/modals/AlertsModal"));
const ScanSettingsModal = lazy(
  () => import("@/components/modals/ScanSettingsModal"),
);
const EditHotelModal = lazy(() => import("@/components/modals/EditHotelModal"));
const SubscriptionModal = lazy(
  () => import("@/components/modals/SubscriptionModal"),
);
const HotelDetailsModal = lazy(
  () => import("@/components/modals/HotelDetailsModal"),
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
  const { userId } = useAuth();
  const {
    data,
    userSettings,
    profile,
    handleAddHotel,
    handleScan,
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
    isScanSettingsOpen,
    setIsScanSettingsOpen,
    scanDefaults,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    selectedHotelForDetails,
    reSearchName,
    setReSearchName,
    reSearchLocation,
    setReSearchLocation,
  } = useModalContext();

  // Hide sidebar on login and admin pages
  const isLoginPage = pathname === "/login";
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!mounted) {
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

  return (
    <div className="flex min-h-screen bg-[#050B18]">
      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050B18]/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-8">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAlertsOpen(true)}
                className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative"
              >
                <Bell className="w-5 h-5 text-slate-300" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050B18]" />
              </button>

              <div className="h-8 w-[1px] bg-white/5 mx-1" />

              {/* Language Toggle */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setLocale("en")}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    locale === "en"
                      ? "bg-[#F6C344] text-[#050B18]"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLocale("tr")}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    locale === "tr"
                      ? "bg-[#F6C344] text-[#050B18]"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  TR
                </button>
              </div>

              <div className="h-8 w-[1px] bg-white/5 mx-1" />

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end items-end hidden sm:flex">
                  <span className="text-xs font-bold text-white">
                    {profile?.full_name || "Enterprise User"}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    {profile?.role === "admin"
                      ? "Administrator"
                      : "Revenue Director"}
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="radial-glow pointer-events-none" />
          <div className="bg-grain pointer-events-none" />
          <div className="relative z-10 p-8 pt-6">{children}</div>
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

        <ScanSettingsModal
          isOpen={isScanSettingsOpen}
          onClose={() => setIsScanSettingsOpen(false)}
          onScan={async (options) => {
            await handleScan(options);
          }}
          onUpgrade={() => {
            setIsScanSettingsOpen(false);
            setIsBillingOpen(true);
          }}
          initialValues={scanDefaults}
          userPlan={
            profile?.role === "admin" ? "enterprise" : profile?.plan_type
          }
          dailyLimitReached={false} // This logic might need to be more robust
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
            profile?.plan_type === "enterprise" || profile?.plan_type === "pro"
          }
          onUpgrade={() => {
            setIsDetailsModalOpen(false);
            setIsBillingOpen(true);
          }}
        />
      </Suspense>
    </div>
  );
}
