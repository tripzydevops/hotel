"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

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
        lg:grid-cols-4
        grid-flow-row-dense
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
 * Command Center styled tile with size variants and spring motion
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
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.01, translateY: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        card-blur p-4 sm:p-6 rounded-[2.5rem]
        flex flex-col
        ${onClick ? "cursor-pointer" : ""}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
