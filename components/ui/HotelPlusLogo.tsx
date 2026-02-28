"use client";

/**
 * Hotel Plus Logo Component
 * Renders the H+ bar chart icon in SVG with optional text/domain.
 * Reusable across Sidebar, Login, Navbar, and Footer.
 */

interface HotelPlusIconProps {
    size?: number;
    className?: string;
}

export function HotelPlusIcon({ size = 40, className = "" }: HotelPlusIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Left vertical bar of H */}
            <rect x="2" y="6" width="9" height="42" rx="2" fill="#F6C344" />

            {/* H crossbar */}
            <rect x="2" y="22" width="35" height="8" rx="2" fill="#F6C344" />

            {/* Bar chart bars (right side — replaces H right leg) */}
            {/* Short bar */}
            <rect x="24" y="36" width="7" height="12" rx="1.5" fill="#F6C344" />
            {/* Medium bar */}
            <rect x="33" y="28" width="7" height="20" rx="1.5" fill="#F6C344" />
            {/* Tall bar */}
            <rect x="42" y="20" width="7" height="28" rx="1.5" fill="#F6C344" />

            {/* Upward trend arrow */}
            <path
                d="M26 33 L48 11"
                stroke="#F6C344"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <path
                d="M48 11 L48 19 M48 11 L40 11"
                stroke="#F6C344"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Plus sign (top of H crossbar, between legs) */}
            <rect x="12" y="2" width="2.5" height="12" rx="1" fill="#F6C344" />
            <rect x="8" y="6.5" width="11" height="2.5" rx="1" fill="#F6C344" />
        </svg>
    );
}

interface HotelPlusLogoProps {
    /** Variant controls layout and sizing */
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
                {/* Icon with metallic border */}
                <div className="relative group/logo">
                    <div className="absolute inset-0 bg-[#F6C344]/20 blur-2xl group-hover/logo:blur-3xl transition-all duration-500 rounded-full" />
                    <div className="metallic-gold p-[1.5px] rounded-2xl animate-float transition-transform group-hover:scale-110 duration-500">
                        <div className="bg-[#050B18] rounded-[15px] flex items-center justify-center h-20 w-20 p-3">
                            <HotelPlusIcon size={52} />
                        </div>
                    </div>
                </div>

                <h1 className="text-4xl font-black text-white tracking-tighter text-center mt-6">
                    Hotel <span className="text-[#F6C344]">Plus</span>
                </h1>
                <p className="text-[10px] text-[#F6C344]/80 uppercase tracking-[0.5em] font-black mt-2">
                    hotelplustr.com
                </p>
            </div>
        );
    }

    if (variant === "navbar") {
        return (
            <div className="flex items-center gap-3">
                <div className="bg-[#050B18] rounded-xl p-1.5 border border-[#F6C344]/20">
                    <HotelPlusIcon size={28} />
                </div>
                <div className="flex flex-col">
                    <span className="text-white font-black text-lg tracking-tighter leading-none">
                        Hotel <span className="text-[#F6C344]">Plus</span>
                    </span>
                    {showDomain && (
                        <span className="text-[9px] text-[#F6C344]/60 tracking-wider font-medium mt-0.5">
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
                <HotelPlusIcon size={32} />
                <div className="flex flex-col">
                    <span className="text-white font-black text-xl tracking-tighter leading-none">
                        Hotel <span className="text-[#F6C344]">Plus</span>
                    </span>
                    <span className="text-[9px] text-[#F6C344]/70 tracking-[0.25em] font-bold mt-0.5 uppercase">
                        hotelplustr.com
                    </span>
                </div>
            </div>
        );
    }

    // Default: sidebar variant
    return (
        <div className="flex items-center gap-4">
            <HotelPlusIcon size={36} />
            <div className="flex flex-col">
                <span className="text-white font-black text-xl tracking-tighter leading-none">
                    Hotel <span className="text-[#F6C344]">Plus</span>
                </span>
                <span className="text-[9px] text-[#F6C344]/80 uppercase tracking-[0.3em] font-black mt-1">
                    hotelplustr.com
                </span>
            </div>
        </div>
    );
}
