"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

// Fix for Leaflet icons in Next.js
import L from "leaflet";
// We don't strictly need default icons if we use CircleMarkers, but good to have safety
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//   iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//   shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
// });

interface HeatmapMapProps {
  hotels: any[];
}

const HeatmapMap = ({ hotels }: HeatmapMapProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted)
    return (
      <div className="h-96 w-full bg-slate-100 animate-pulse rounded-lg" />
    );

  // Calculate center
  const validHotels = hotels.filter((h) => h.latitude && h.longitude);
  if (validHotels.length === 0)
    return (
      <div className="p-4 text-center text-gray-500">
        No geospatial data available. Run a scan to populate map.
      </div>
    );

  const centerLat =
    validHotels.reduce((sum, h) => sum + h.latitude, 0) / validHotels.length;
  const centerLon =
    validHotels.reduce((sum, h) => sum + h.longitude, 0) / validHotels.length;

  // Helper for color coding price velocity (mock logic for now if we don't have historicals handy in this view)
  // We'll trust 'price' high/low relative to something?
  // Or just make target hotel distinct.

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 z-0 relative">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validHotels.map((h) => {
          const isTarget = h.is_target_hotel;
          const price = h.price || 0;

          // Simple color scale: Target = Blue, Others = Red/Orange/Green based on price?
          // Let's just do Target = Blue, Compset = Red for now.
          const color = isTarget ? "#3b82f6" : "#ef4444";

          return (
            <CircleMarker
              key={h.id}
              center={[h.latitude, h.longitude]}
              pathOptions={{
                fillColor: color,
                color: isTarget ? "#1e40af" : "#991b1b",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7,
              }}
              radius={isTarget ? 12 : 8}
            >
              <Popup>
                <div className="text-sm font-sans">
                  <strong className="block text-slate-800 text-base mb-1">
                    {h.name}
                  </strong>
                  <div className="text-slate-600 mb-1">{h.location}</div>
                  <div className="text-lg font-bold text-slate-900">
                    {price > 0
                      ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: h.currency || "USD" }).format(price)}`
                      : "N/A"}
                  </div>
                  {isTarget && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      Target Hotel
                    </span>
                  )}
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                {h.name}: {price > 0 ? `${price} ${h.currency}` : "N/A"}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default HeatmapMap;
