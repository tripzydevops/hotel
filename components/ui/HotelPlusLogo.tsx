"use client";

/**
 * Hotel Plus Logo Component
 * Uses the exact official SVG provided by the brand.
 * Exported in two forms:
 *   - HotelPlusIcon  : icon mark only (no text), scalable
 *   - HotelPlusLogo  : full logo with layout variants for each app location
 */

interface HotelPlusIconProps {
    size?: number;
    className?: string;
}

/** The icon mark only — H + bar chart + trend arrow + plus sign, no background rect, no text. */
export function HotelPlusIcon({ size = 40, className = "" }: HotelPlusIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="50 130 420 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* H left vertical */}
            <path d="M160 150V310H200V150H160Z" fill="#D4AF37" />
            {/* H crossbar */}
            <path d="M160 220H240V260H160V220Z" fill="#D4AF37" />
            {/* H right vertical */}
            <path d="M240 150V310H280V150H240Z" fill="#D4AF37" />
            {/* Bar chart short */}
            <path d="M300 240V310H330V240H300Z" fill="#D4AF37" />
            {/* Bar chart tall */}
            <path d="M350 180V310H380V180H350Z" fill="#D4AF37" />
            {/* Trend arrow */}
            <path
                d="M225 305L300 215L340 250L395 145M395 145H365M395 145V175"
                stroke="#D4AF37"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Plus sign */}
            <path
                d="M295 170H315M305 160V180"
                stroke="#D4AF37"
                strokeWidth="6"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Full logo with navy rounded-square background (matches original asset exactly). */
export function HotelPlusFullSVG({ size = 120 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect width="512" height="512" rx="64" fill="#0D1B2A" />
            <path d="M160 150V310H200V150H160Z" fill="#D4AF37" />
            <path d="M160 220H240V260H160V220Z" fill="#D4AF37" />
            <path d="M240 150V310H280V150H240Z" fill="#D4AF37" />
            <path d="M300 240V310H330V240H300Z" fill="#D4AF37" />
            <path d="M350 180V310H380V180H350Z" fill="#D4AF37" />
            <path
                d="M225 305L300 215L340 250L395 145M395 145H365M395 145V175"
                stroke="#D4AF37"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M295 170H315M305 160V180"
                stroke="#D4AF37"
                strokeWidth="6"
                strokeLinecap="round"
            />
        </svg>
    );
}

interface HotelPlusLogoProps {
    variant?: "sidebar" | "login" | "navbar" | "footer";
    showDomain?: boolean;
}

export default function HotelPlusLogo({
    variant = "sidebar",
    showDomain = false,
}: HotelPlusLogoProps) {
    if (variant === "login") {
        return (
            <div className="flex flex-col items-center">
                <div className="relative group/logo">
                    <div className="absolute inset-0 bg-[#D4AF37]/20 blur-2xl group-hover/logo:blur-3xl transition-all duration-500 rounded-2xl" />
                    <div className="relative animate-float transition-transform group-hover:scale-110 duration-500 rounded-2xl overflow-hidden shadow-2xl shadow-[#D4AF37]/10">
                        <HotelPlusFullSVG size={88} />
                    </div>
                </div>
                <h1 className="text-4xl font-black text-white tracking-tighter text-center mt-6">
                    Hotel <span className="text-[#D4AF37]">Plus</span>
                </h1>
                <p className="text-[10px] text-[#D4AF37]/80 uppercase tracking-[0.5em] font-black mt-2">
                    hotelplustr.com
                </p>
            </div>
        );
    }

    if (variant === "navbar") {
        return (
            <div className="flex items-center gap-3">
                <div className="rounded-xl overflow-hidden shadow-lg">
                    <HotelPlusFullSVG size={36} />
                </div>
                <div className="flex flex-col">
                    <span className="text-white font-black text-lg tracking-tighter leading-none">
                        Hotel <span className="text-[#D4AF37]">Plus</span>
                    </span>
                    {showDomain && (
                        <span className="text-[9px] text-[#D4AF37]/60 tracking-wider font-medium mt-0.5">
                            hotelplustr.com
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (variant === "footer") {
        return (
            <div className="flex items-center gap-3">
                <div className="rounded-xl overflow-hidden">
                    <HotelPlusFullSVG size={40} />
                </div>
                <div className="flex flex-col">
                    <span className="text-white font-black text-xl tracking-tighter leading-none">
                        Hotel <span className="text-[#D4AF37]">Plus</span>
                    </span>
                    <span className="text-[9px] text-[#D4AF37]/70 tracking-[0.25em] font-bold mt-0.5 uppercase">
                        hotelplustr.com
                    </span>
                </div>
            </div>
        );
    }

    // Default: sidebar
    return (
        <div className="flex items-center gap-3">
            <div className="rounded-xl overflow-hidden">
                <HotelPlusFullSVG size={40} />
            </div>
            <div className="flex flex-col">
                <span className="text-white font-black text-xl tracking-tighter leading-none">
                    Hotel <span className="text-[#D4AF37]">Plus</span>
                </span>
                <span className="text-[9px] text-[#D4AF37]/80 uppercase tracking-[0.3em] font-black mt-1">
                    hotelplustr.com
                </span>
            </div>
        </div>
    );
}
