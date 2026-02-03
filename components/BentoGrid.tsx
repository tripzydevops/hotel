"use client";

import { ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Bento Grid Container
 * Responsive grid layout for dashboard tiles
 */
export default function BentoGrid({
  children,
  className = "",
}: BentoGridProps) {
  return (
    <div
      className={`
        grid gap-4
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-3
        auto-rows-[minmax(180px,auto)]
        grid-flow-dense
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface BentoTileProps {
  children: ReactNode;
  className?: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

/**
 * Individual Bento Tile
 * Glassmorphism styled tile with size variants
 */
export function BentoTile({
  children,
  className = "",
  size = "small",
  onClick,
}: BentoTileProps) {
  const sizeClasses = {
    small: "col-span-1 row-span-1",
    medium: "col-span-1 sm:col-span-2 lg:col-span-2 row-span-1", // Wide
    large: "col-span-1 sm:col-span-2 lg:col-span-2 row-span-2", // Big square
    tall: "col-span-1 row-span-2", // Tall vertical
  };

  return (
    <div
      onClick={onClick}
      className={`
        glass-card p-4 sm:p-6
        flex flex-col
        transition-all duration-300
        hover:scale-[1.02]
        ${onClick ? "cursor-pointer" : ""}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
