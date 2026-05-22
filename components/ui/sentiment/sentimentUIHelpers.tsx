import {
  Users,
  Sparkles,
  MapPin,
  Coins,
  Moon,
  Bed,
  Coffee,
  Building2,
  Heart,
  MessageSquare,
} from "lucide-react";

/* ── Translation map for sentiment keywords (TR → EN) ── */
export const KEYWORD_TRANSLATIONS: Record<string, string> = {
  hizmet: "Service",
  temizlik: "Cleanliness",
  konum: "Location",
  oda: "Room",
  kahvaltı: "Breakfast",
  fiyat: "Price",
  yemek: "Food",
  havuz: "Pool",
  personel: "Staff",
  sessizlik: "Quietness",
  konfor: "Comfort",
  banyo: "Bathroom",
  yatak: "Bed",
  resepsiyon: "Reception",
  manzara: "View",
  ulaşım: "Transport",
  internet: "Internet",
  wifi: "Wi-Fi",
  otopark: "Parking",
  güvenlik: "Security",
  dining: "Dining",
  restoran: "Restaurant",
  bar: "Bar",
  "gece hayatı": "Nightlife",
  "sağlıklı yaşam": "Wellness",
  çiftler: "Couples",
  iş: "Business",
  mülk: "Property",
  uyku: "Sleep",
  atmosfer: "Atmosphere",
  kablosuz: "Wi-Fi",
  klima: "A/C",
  fitness: "Fitness",
  erişilebilirlik: "Accessibility",
  mutfak: "Kitchen",
};

/* ── UI Helpers for Guest Voice Redesign ── */
export const getCategoryIcon = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service"))
    return <Users className="w-3.5 h-3.5 text-indigo-400" />;
  if (key.includes("clean"))
    return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
  if (key.includes("location"))
    return <MapPin className="w-3.5 h-3.5 text-amber-400" />;
  if (key.includes("value"))
    return <Coins className="w-3.5 h-3.5 text-yellow-400" />;
  if (key.includes("sleep"))
    return <Moon className="w-3.5 h-3.5 text-purple-400" />;
  if (key.includes("room"))
    return <Bed className="w-3.5 h-3.5 text-sky-400" />;
  if (key.includes("breakfast"))
    return <Coffee className="w-3.5 h-3.5 text-rose-400" />;
  if (key.includes("property"))
    return <Building2 className="w-3.5 h-3.5 text-cyan-400" />;
  if (key.includes("spa"))
    return <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />;
  if (key.includes("family"))
    return <Heart className="w-3.5 h-3.5 text-pink-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-slate-400" />;
};

export const getCategoryGlow = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service"))
    return "from-indigo-500/[0.08] dark:from-indigo-500/[0.12]";
  if (key.includes("clean"))
    return "from-emerald-500/[0.08] dark:from-emerald-500/[0.12]";
  if (key.includes("location"))
    return "from-amber-500/[0.08] dark:from-amber-500/[0.12]";
  if (key.includes("value"))
    return "from-yellow-500/[0.08] dark:from-yellow-500/[0.12]";
  if (key.includes("sleep"))
    return "from-purple-500/[0.08] dark:from-purple-500/[0.12]";
  if (key.includes("room"))
    return "from-sky-500/[0.08] dark:from-sky-500/[0.12]";
  if (key.includes("breakfast"))
    return "from-rose-500/[0.08] dark:from-rose-500/[0.12]";
  if (key.includes("property"))
    return "from-cyan-500/[0.08] dark:from-cyan-500/[0.12]";
  if (key.includes("spa"))
    return "from-fuchsia-500/[0.08] dark:from-fuchsia-500/[0.12]";
  if (key.includes("family"))
    return "from-pink-500/[0.08] dark:from-pink-500/[0.12]";
  return "from-slate-500/[0.08] dark:from-slate-500/[0.12]";
};

export const getCategoryDotColor = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service"))
    return "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]";
  if (key.includes("clean"))
    return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
  if (key.includes("location"))
    return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
  if (key.includes("value"))
    return "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]";
  if (key.includes("sleep"))
    return "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]";
  if (key.includes("room"))
    return "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]";
  if (key.includes("breakfast"))
    return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]";
  if (key.includes("property"))
    return "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]";
  if (key.includes("spa"))
    return "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]";
  if (key.includes("family"))
    return "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]";
  return "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.6)]";
};

export const getCategoryDisplayName = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service")) return "Service Excellence";
  if (key.includes("clean")) return "Cleanliness & Housekeeping";
  if (key.includes("location")) return "Location & Convenience";
  if (key.includes("value")) return "Value & Pricing";
  if (key.includes("sleep")) return "Sleep Comfort";
  if (key.includes("room")) return "Room Quality";
  if (key.includes("breakfast")) return "Breakfast & Dining";
  if (key.includes("property")) return "Property Facilities";
  if (key.includes("spa")) return "Spa & Wellness";
  if (key.includes("family")) return "Family & Convenience";
  return name;
};
