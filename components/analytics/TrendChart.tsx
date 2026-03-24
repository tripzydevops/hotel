"use client";

import { useMemo } from "react";
import { PricePoint } from "@/types";

interface TrendChartProps {
  data: PricePoint[];
  color?: string; // Hex color for the line
  height?: number;
  width?: number;
  className?: string;
}

export default function TrendChart({ 
  data, 
  color = "#10B981", 
  height = 40, 
  width = 120,
  className = "" 
}: TrendChartProps) {
  
  const { linePoints, areaPoints } = useMemo(() => {
    if (!data || data.length < 2) return { linePoints: "", areaPoints: "" };
    
    // Sort by date (oldest to newest)
    const sorted = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    
    const prices = sorted.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    
    // Padding to prevent clipping stroke
    const paddingY = 4;
    const availableHeight = height - (paddingY * 2);

    const points = sorted.map((p, i) => {
      const x = (i / (sorted.length - 1)) * width;
      // If range is 0 (flat line), center it
      const normalizedPrice = range === 0 ? 0.5 : (p.price - minPrice) / range;
      const y = paddingY + ((1 - normalizedPrice) * availableHeight);
      return [x, y];
    });

    const lineStr = points.map(p => `${p[0]},${p[1]}`).join(" ");
    const areaStr = `${points[0][0]},${height} ` + lineStr + ` ${points[points.length-1][0]},${height}`;

    return { linePoints: lineStr, areaPoints: areaStr };
  }, [data, height, width]);

  if (!data || data.length < 2) return null;
  
  // Unique ID for gradient (simple hash to avoid conflicts)
  const gradientId = `trendGradient-${color.replace("#", "")}`;

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${width} ${height}`} 
      preserveAspectRatio="none"
      className={`overflow-visible ${className}`}
    >
        <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
        </defs>
        
        <polygon 
            points={areaPoints} 
            fill={`url(#${gradientId})`} 
            stroke="none"
        />

        <polyline 
            points={linePoints} 
            fill="none" 
            stroke={color} 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
        />
    </svg>
  );
}
