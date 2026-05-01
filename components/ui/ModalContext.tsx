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
  isDetailsModalOpen: boolean;
  setIsDetailsModalOpen: (open: boolean) => void;
  selectedHotelForDetails: Hotel | null;
  setSelectedHotelForDetails: (hotel: Hotel | null) => void;
  reSearchName: string;
  setReSearchName: (name: string) => void;
  reSearchLocation: string;
  setReSearchLocation: (location: string) => void;
  isIntradayModalOpen: boolean;
  setIsIntradayModalOpen: (open: boolean) => void;
  selectedIntradayEvents: any[] | null;
  setSelectedIntradayEvents: (events: any[] | null) => void;
  selectedIntradayHotelName: string;
  setSelectedIntradayHotelName: (name: string) => void;
  openIntradayModal: (events: any[], hotelName: string) => void;
  handleOpenAddHotel: () => void;
  handleOpenDetails: (hotel: Hotel) => void;
  handleOpenSession: (session: ScanSession) => void;
  handleEditHotel: (hotel: Hotel) => void;
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


  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedHotelForDetails, setSelectedHotelForDetails] =
    useState<Hotel | null>(null);

  const [reSearchName, setReSearchName] = useState("");
  const [reSearchLocation, setReSearchLocation] = useState("");

  const [isIntradayModalOpen, setIsIntradayModalOpen] = useState(false);
  const [selectedIntradayEvents, setSelectedIntradayEvents] = useState<any[] | null>(null);
  const [selectedIntradayHotelName, setSelectedIntradayHotelName] = useState("");

  // Handlers
  const handleOpenAddHotel = () => {
    setIsAddHotelOpen(true);
  };

  const handleOpenDetails = (hotel: Hotel) => {
    setSelectedHotelForDetails(hotel);
    setIsDetailsModalOpen(true);
  };

  const handleOpenSession = (session: ScanSession) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const handleEditHotel = (hotel: Hotel) => {
    setHotelToEdit(hotel);
    setIsEditHotelOpen(true);
  };

  const handleReSearch = (name: string, location?: string) => {
    setReSearchName(name);
    setReSearchLocation(location || "");
    setIsAddHotelOpen(true);
  };

  const openIntradayModal = (events: any[], hotelName: string) => {
    setSelectedIntradayEvents(events);
    setSelectedIntradayHotelName(hotelName);
    setIsIntradayModalOpen(true);
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
      isDetailsModalOpen,
      setIsDetailsModalOpen,
      selectedHotelForDetails,
      setSelectedHotelForDetails,
      reSearchName,
      setReSearchName,
      reSearchLocation,
      setReSearchLocation,
      isIntradayModalOpen,
      setIsIntradayModalOpen,
      selectedIntradayEvents,
      setSelectedIntradayEvents,
      selectedIntradayHotelName,
      setSelectedIntradayHotelName,
      openIntradayModal,
      handleOpenAddHotel,
      handleOpenDetails,
      handleOpenSession,
      handleEditHotel,
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
      isDetailsModalOpen,
      selectedHotelForDetails,
      reSearchName,
      reSearchLocation,
      isIntradayModalOpen,
      selectedIntradayEvents,
      selectedIntradayHotelName,
      openIntradayModal,
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
