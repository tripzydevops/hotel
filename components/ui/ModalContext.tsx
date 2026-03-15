"use client";

import { createContext, useContext, ReactNode, useState, useMemo } from "react";
import { Hotel, ScanSession, DashboardData } from "@/types";

interface ModalContextType {
  isAddHotelOpen: boolean;
  setIsAddHotelOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isAlertsOpen: boolean;
  setIsAlertsOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isBillingOpen: boolean;
  setIsBillingOpen: (open: boolean) => void;
  isEditHotelOpen: boolean;
  setIsEditHotelOpen: (open: boolean) => void;
  hotelToEdit: Hotel | null;
  setHotelToEdit: (hotel: Hotel | null) => void;
  isSessionModalOpen: boolean;
  setIsSessionModalOpen: (open: boolean) => void;
  selectedSession: ScanSession | null;
  setSelectedSession: (session: ScanSession | null) => void;
  isScanSettingsOpen: boolean;
  setIsScanSettingsOpen: (open: boolean) => void;
  scanDefaults:
  | { checkIn?: string; checkOut?: string; adults?: number }
  | undefined;
  setScanDefaults: (
    defaults:
      | { checkIn?: string; checkOut?: string; adults?: number }
      | undefined,
  ) => void;
  isDetailsModalOpen: boolean;
  setIsDetailsModalOpen: (open: boolean) => void;
  selectedHotelForDetails: Hotel | null;
  setSelectedHotelForDetails: (hotel: Hotel | null) => void;
  reSearchName: string;
  setReSearchName: (name: string) => void;
  reSearchLocation: string;
  setReSearchLocation: (location: string) => void;

  // Handlers
  handleOpenDetails: (hotel: Hotel, data: DashboardData | null) => void;
  handleOpenSession: (session: ScanSession) => void;
  handleEditHotel: (id: string, data: DashboardData | null) => void;
  handleRefresh: (data: DashboardData | null) => void;
  handleReSearch: (name: string, location?: string) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isAddHotelOpen, setIsAddHotelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  const [isEditHotelOpen, setIsEditHotelOpen] = useState(false);
  const [hotelToEdit, setHotelToEdit] = useState<Hotel | null>(null);

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(
    null,
  );

  const [isScanSettingsOpen, setIsScanSettingsOpen] = useState(false);
  const [scanDefaults, setScanDefaults] = useState<
    { checkIn?: string; checkOut?: string; adults?: number } | undefined
  >(undefined);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedHotelForDetails, setSelectedHotelForDetails] =
    useState<Hotel | null>(null);

  const [reSearchName, setReSearchName] = useState("");
  const [reSearchLocation, setReSearchLocation] = useState("");

  const handleOpenDetails = async (hotel: Hotel, data: DashboardData | null) => {
    // Determine if we already have the "heavy" fields (Payload Shaving check)
    const hasHeavyData = (hotel as any).amenities && (hotel as any).amenities.length > 0;

    let targetHotel = hotel;

    if (!hasHeavyData) {
      console.log(`[LazyLoad] Fetching heavy metadata for hotel: ${hotel.id}`);
      try {
        const { api } = await import("@/lib/api");
        const fullData = await api.getHotel(hotel.id);
        if (fullData) {
          targetHotel = { ...hotel, ...fullData };
        }
      } catch (err) {
        console.error("[LazyLoad] Failed to fetch hotel details:", err);
        // Fallback to what we have
      }
    }

    setSelectedHotelForDetails(targetHotel);
    setIsDetailsModalOpen(true);
  };


  const handleOpenSession = (session: ScanSession) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const handleEditHotel = (id: string, data: DashboardData | null) => {
    const fullHotel =
      data?.competitors.find((h) => h.id === id) ||
      (data?.target_hotel?.id === id ? data.target_hotel : null);
    if (fullHotel) {
      setHotelToEdit(fullHotel);
      setIsEditHotelOpen(true);
    }
  };

  const handleRefresh = (data: DashboardData | null) => {
    // Only set defaults if they are current or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (data?.target_hotel?.price_info?.check_in) {
      const checkInDate = new Date(data.target_hotel.price_info.check_in);
      if (checkInDate >= today) {
        // Validate that checkOut is strictly after checkIn; fix if not
        const storedCheckOut = data.target_hotel.price_info.check_out;
        const checkOutDate = storedCheckOut ? new Date(storedCheckOut) : null;
        const minCheckOut = new Date(checkInDate);
        minCheckOut.setDate(minCheckOut.getDate() + 1);
        const validCheckOut =
          checkOutDate && checkOutDate > checkInDate
            ? storedCheckOut
            : [
              minCheckOut.getFullYear(),
              String(minCheckOut.getMonth() + 1).padStart(2, "0"),
              String(minCheckOut.getDate()).padStart(2, "0"),
            ].join("-");
        setScanDefaults({
          checkIn: data.target_hotel.price_info.check_in,
          checkOut: validCheckOut,
          adults: data.target_hotel.price_info.adults,
        });
      } else {
        // Clear old dates to use "Today" default
        setScanDefaults(undefined);
      }
    } else {
      setScanDefaults(undefined);
    }
    setIsScanSettingsOpen(true);
  };

  const handleReSearch = (name: string, location?: string) => {
    setReSearchName(name);
    setReSearchLocation(location || "");
    setIsAddHotelOpen(true);
  };

  const value = useMemo(
    () => ({
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
      setSelectedSession,
      isScanSettingsOpen,
      setIsScanSettingsOpen,
      scanDefaults,
      setScanDefaults,
      isDetailsModalOpen,
      setIsDetailsModalOpen,
      selectedHotelForDetails,
      setSelectedHotelForDetails,
      reSearchName,
      setReSearchName,
      reSearchLocation,
      setReSearchLocation,
      handleOpenDetails,
      handleOpenSession,
      handleEditHotel,
      handleRefresh,
      handleReSearch,
    }),
    [
      isAddHotelOpen,
      isSettingsOpen,
      isAlertsOpen,
      isProfileOpen,
      isBillingOpen,
      isEditHotelOpen,
      hotelToEdit,
      isSessionModalOpen,
      selectedSession,
      isScanSettingsOpen,
      scanDefaults,
      isDetailsModalOpen,
      selectedHotelForDetails,
      reSearchName,
      reSearchLocation,
    ],
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}

export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModalContext must be used within a ModalProvider");
  }
  return context;
}
