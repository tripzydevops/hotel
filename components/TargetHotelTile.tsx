"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";
import HotelTile from "./HotelTile";

export type TrendDirection = "up" | "down" | "stable";

interface TargetHotelTileProps {
  id: string;
  name: string;
  location?: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  lastUpdated?: string;
  onDelete?: (id: string) => void;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  vendor?: string;
  priceHistory?: PricePoint[];
  checkIn?: string;
  adults?: number;
  onEdit?: (id: string, hotel: any) => void;
  onViewDetails?: (hotel: any) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];
  offers?: { vendor?: string; price?: number }[];
}

/**
 * Target Hotel Tile (Large Format)
 * Displays user's own hotel with prominent pricing
 */
export default function TargetHotelTile(props: TargetHotelTileProps) {
  const { t } = useI18n();

  return (
    <HotelTile
      {...props}
      variant="target"
      footerStats={true}
      headerBadges={
        <span className="text-[10px] uppercase tracking-widest text-[var(--soft-gold)] font-bold bg-[var(--soft-gold)]/10 px-2 py-0.5 rounded-full">
          {t("common.myHotel")}
        </span>
      }
    />
  );
}
