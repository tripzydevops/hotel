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
    small: "",
    medium: "sm:col-span-1 lg:col-span-1 lg:row-span-1",
    large: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
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
