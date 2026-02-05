"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Plus, MapPin, Star, Trophy, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface DiscoveryRival {
  id: string;
  name: string;
  location: string;
  stars: number;
  rating: number;
  similarity: number;
}

interface DiscoveryShardProps {
  hotelId: string;
}

export default function DiscoveryShard({ hotelId }: DiscoveryShardProps) {
  const [rivals, setRivals] = useState<DiscoveryRival[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchRivals = async () => {
      try {
        const response = await fetch(`/api/discovery/${hotelId}`);
        const data = await response.json();
        setRivals(data.rivals || []);
      } catch (error) {
        console.error("Discovery error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (hotelId) {
      fetchRivals();
    } else {
      setLoading(false);
    }
  }, [hotelId]);

  const handleAddRival = async (rival: DiscoveryRival) => {
    setAddingId(rival.id);
    try {
      // In a real flow, this would add the rival to the user's tracking list
      // For this demo, we'll simulate an onboarding action
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Add to 'hotels' table (User's private watch-list)
      const { error } = await supabase.table("hotels").insert({
        user_id: userData.user.id,
        name: rival.name,
        location: rival.location,
        stars: rival.stars,
        rating: rival.rating,
        is_target_hotel: false,
        serp_api_id: "", // We ideally fetch this from directory in backend
      });

      if (!error) {
        setRivals((prev) => prev.filter((r) => r.id !== rival.id));
      }
    } catch (error) {
      console.error("Error adding rival:", error);
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mb-4" />
        <p className="text-sm text-white/50 animate-pulse">
          Analyst Agent is scouting the market...
        </p>
      </div>
    );
  }

  if (rivals.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20">
          <Sparkles className="w-4 h-4 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">
            Rival Discovery Engine
          </h2>
          <p className="text-xs text-white/40">
            Autonomous suggestions based on semantic "vibe" mapping
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rivals.map((rival) => (
          <div
            key={rival.id}
            className="glass-card group relative p-5 border border-white/5 hover:border-[var(--soft-gold)]/30 transition-all duration-500 overflow-hidden"
          >
            {/* Match Percentage Badge */}
            <div className="absolute top-4 right-4 px-2 py-1 rounded-md bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 backdrop-blur-md">
              <span className="text-[10px] font-black text-[var(--soft-gold)]">
                {Math.round(rival.similarity * 100)}% MATCH
              </span>
            </div>

            <div className="space-y-4">
              <div className="pr-16">
                <h3 className="text-sm font-bold text-white group-hover:text-[var(--soft-gold)] transition-colors line-clamp-1">
                  {rival.name}
                </h3>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-white/40">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{rival.location}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-tighter text-white/30">
                    Rating
                  </span>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-[var(--soft-gold)]" />
                    <span className="text-sm font-black text-white">
                      {rival.rating}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[10px] uppercase tracking-tighter text-white/30">
                    Class
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-white/60" />
                    <span className="text-sm font-black text-white">
                      {rival.stars}★
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleAddRival(rival)}
                disabled={addingId === rival.id}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-[var(--soft-gold)] hover:text-black hover:border-transparent transition-all duration-300 disabled:opacity-50 group/btn"
              >
                {addingId === rival.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Track Rival
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Subtle background glow */}
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[var(--soft-gold)]/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}
