"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
}

export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    const sideClasses = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 border border-slate-800 rounded-lg shadow-xl pointer-events-none break-words ${sideClasses[side]} ${className}`}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// TooltipProvider, TooltipTrigger, TooltipContent shims for compatibility with existing imports
export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => <>{children}</>;
export const TooltipContent = ({ children, side, className }: { children: React.ReactNode, side?: "top" | "bottom" | "left" | "right", className?: string }) => null;
// Note: The simple Tooltip above handles content internally. 
// I will refactor CompressionCalendar to use the simplified Tooltip.
