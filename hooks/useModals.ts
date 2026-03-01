import { useState } from "react";
import { Hotel, ScanSession, DashboardData } from "@/types";

export function useModals() {
  const [isAddHotelOpen, setIsAddHotelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  
  const [isEditHotelOpen, setIsEditHotelOpen] = useState(false);
  const [hotelToEdit, setHotelToEdit] = useState<Hotel | null>(null);

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(null);

  const [isScanSettingsOpen, setIsScanSettingsOpen] = useState(false);
  const [scanDefaults, setScanDefaults] = useState<{ checkIn?: string; checkOut?: string; adults?: number } | undefined>(undefined);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<any>(null);

  const [reSearchName, setReSearchName] = useState("");
  const [reSearchLocation, setReSearchLocation] = useState("");

  const handleOpenDetails = (hotel: any, data: DashboardData | null) => {
    const fullHotel =
      data?.competitors.find((h) => h.id === hotel.id) ||
      (data?.target_hotel?.id === hotel.id ? data?.target_hotel : null);
    
    // Fallback to the passed hotel object if not found in data (or if data is partial)
    if (fullHotel || hotel) {
      setSelectedHotelForDetails(fullHotel || hotel);
      setIsDetailsModalOpen(true);
    }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (data?.target_hotel?.price_info) {
      const checkInDate = new Date(data.target_hotel.price_info.check_in);
      if (checkInDate >= today) {
        setScanDefaults({
          checkIn: data.target_hotel.price_info.check_in,
          checkOut: data.target_hotel.price_info.check_out,
          adults: data.target_hotel.price_info.adults,
        });
      } else {
        setScanDefaults(undefined);
      }
    }
    setIsScanSettingsOpen(true);
  };

  const handleReSearch = (name: string, location?: string) => {
    setReSearchName(name);
    setReSearchLocation(location || "");
    setIsAddHotelOpen(true);
  };

  return {
    // State
    isAddHotelOpen, setIsAddHotelOpen,
    isSettingsOpen, setIsSettingsOpen,
    isAlertsOpen, setIsAlertsOpen,
    isProfileOpen, setIsProfileOpen,
    isBillingOpen, setIsBillingOpen,
    isEditHotelOpen, setIsEditHotelOpen,
    hotelToEdit, setHotelToEdit,
    isSessionModalOpen, setIsSessionModalOpen,
    selectedSession, setSelectedSession,
    isScanSettingsOpen, setIsScanSettingsOpen,
    scanDefaults, setScanDefaults,
    isDetailsModalOpen, setIsDetailsModalOpen,
    selectedHotelForDetails, setSelectedHotelForDetails,
    reSearchName, setReSearchName,
    reSearchLocation, setReSearchLocation,

    // Handlers
    handleOpenDetails,
    handleOpenSession,
    handleEditHotel,
    handleRefresh,
    handleReSearch,
  };
}
