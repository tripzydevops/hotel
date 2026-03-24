"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// Dynamically import the Map component to avoid SSR issues with Leaflet
const HeatmapMap = dynamic(() => import("./HeatmapMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">
      Loading Map...
    </div>
  ),
});

interface HeatmapPanelProps {
  hotels: any[];
}

export default function HeatmapPanel({ hotels }: HeatmapPanelProps) {
  // Filter hotels with valid coordinates
  const validHotels = useMemo(() => {
    return hotels.filter((h) => h.latitude && h.longitude);
  }, [hotels]);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Market Compression Map
          </h2>
          <p className="text-sm text-slate-500">
            Geospatial view of competitor pricing and anomalies.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">
            {validHotels.length}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">
            Mapped Hotels
          </div>
        </div>
      </div>

      {validHotels.length > 0 ? (
        <HeatmapMap hotels={validHotels} />
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <p>No geospatial data available.</p>
          <p className="text-xs mt-2">Run a scan to populate coordinates.</p>
        </div>
      )}
    </div>
  );
}
