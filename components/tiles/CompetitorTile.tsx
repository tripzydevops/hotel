import { HotelWithPrice, GuestMention } from "@/types";
"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Hotel,
  Trash2,
  Edit2,
} from "lucide-react";

import { PricePoint, HotelImage } from "@/types";
import { useI18n } from "@/lib/i18n";
import HotelTile from "./HotelTile";

export type TrendDirection = "up" | "down" | "stable";

interface CompetitorTileProps {
  id: string;
  name: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  isUndercut?: boolean;
  rank?: number;
  onDelete?: (id: string) => void;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  vendor?: string;
  priceHistory?: PricePoint[];
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  onEdit?: (id: string, hotel: any) => void;

  onViewDetails?: (hotel: HotelWithPrice) => void;
  onSetTarget?: (id: string) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: HotelImage[];
  offers?: { vendor?: string; source?: string; price?: number }[];
  room_types?: { name?: string; price?: number; currency?: string }[];
  isEstimated?: boolean;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
  cid?: string;
  placeId?: string;
  lastUpdated?: string;
  isScanning?: boolean;
}

export default function CompetitorTile(props: CompetitorTileProps) {
  return (
    <HotelTile
      {...props}
      variant="competitor"
      onSetTarget={props.onSetTarget}
      headerBadges={
        props.rank ? (
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--overlay-border)] text-[9px] font-black text-[var(--text-secondary)] uppercase">
            #{props.rank}
          </span>
        ) : null
      }
    />
  );
}
