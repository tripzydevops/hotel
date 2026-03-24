"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BedDouble,
  Check,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface RoomMatch {
  hotelName: string;
  matchedRoomName: string | null;
  matchScore: number;
}

interface RoomTypeMapperProps {
  selectedRoomType: string;
  matches: RoomMatch[];
}

export default function RoomTypeMapper({
  selectedRoomType,
  matches,
}: RoomTypeMapperProps) {
  if (!selectedRoomType) return null;

  // Filter out the target hotel itself if needed, or just show all competitors
  // We assume 'matches' passed in are competitors
  const validMatches = matches.filter((m) => m.matchedRoomName);

  return (
    <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[var(--deep-ocean-light)] text-[var(--soft-gold)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">
            Semantic Room Matching
          </h3>
          <p className="text-[10px] text-[var(--text-muted)]">
            AI-powered correlation for{" "}
            <span className="text-[var(--soft-gold)] font-bold">
              "{selectedRoomType}"
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {validMatches.length > 0 ? (
          validMatches.map((match, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[var(--soft-gold)]/30 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1 truncate">
                  {match.hotelName}
                </div>
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-[var(--soft-gold)]" />
                  <span className="text-xs font-medium text-white truncate">
                    {match.matchedRoomName}
                  </span>
                </div>
              </div>

              <div className="ml-3 flex flex-col items-end">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--optimal-green)]/10 border border-[var(--optimal-green)]/20">
                  <span className="text-[8px] font-black text-[var(--optimal-green)]">
                    {Math.round(match.matchScore * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full flex items-center justify-center p-8 text-[var(--text-muted)] text-xs border border-dashed border-white/10 rounded-xl">
            <AlertCircle className="w-4 h-4 mr-2" />
            No direct semantic matches found for this room type. showing lead
            prices.
          </div>
        )}
      </div>
    </div>
  );
}
