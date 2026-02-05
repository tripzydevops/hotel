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
import { formatCurrency } from "@/lib/utils";
import { PricePoint } from "@/types";
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
  adults?: number;
  onEdit?: (id: string, hotel: any) => void;

  onViewDetails?: (hotel: any) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];
}

export default function CompetitorTile(props: CompetitorTileProps) {
  return (
    <HotelTile
      {...props}
      variant="competitor"
      headerBadges={
        props.rank ? (
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-black text-[var(--text-secondary)] uppercase">
            #{props.rank}
          </span>
        ) : null
      }
    />
  );
}
