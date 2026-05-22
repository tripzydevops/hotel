import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with clsx for conditional classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency with proper locale
 */
export function formatCurrency(
  amount: number | string,
  currency: string = "USD",
  locale: string = "en-US",
): string {
  const numericAmount = typeof amount === "string" ? parsePrice(amount) : amount;
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

/**
 * Sanitize and parse price strings with commas and currency symbols
 */
/**
 * Sanitize and parse price strings with international format support (commas/dots)
 */
export function parsePrice(price: string | number | null | undefined): number {
  if (typeof price === "number") return price;
  if (price === null || price === undefined || price === "") return 0;
  
  try {
    let s = price.toString().trim();
    // Remove everything except digits, dots, commas, and minus
    let sClean = s.replace(/[^\d.,-]/g, "");

    // Case 1: Both . and , exist (e.g. "3.825,00" or "3,825.00")
    if (sClean.includes(".") && sClean.includes(",")) {
      if (sClean.lastIndexOf(",") > sClean.lastIndexOf(".")) {
        // Turkish/European: Dot is thousand, Comma is decimal
        sClean = sClean.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // US/UK: Comma is thousand, Dot is decimal
        sClean = sClean.replace(/,/g, "");
      }
    }
    // Case 2: Only Dot or Comma exists (e.g. "3.825" or "150,50")
    else if (sClean.includes(".") || sClean.includes(",")) {
      const lastSepIdx = Math.max(sClean.lastIndexOf("."), sClean.lastIndexOf(","));
      const trailingDigits = sClean.length - lastSepIdx - 1;
      
      // If there are exactly 3 trailing digits after the last separator,
      // it's very likely a thousand separator (e.g. "1.234" or "1,234")
      if (trailingDigits === 3) {
        sClean = sClean.replace(/\./g, "").replace(/,/g, "");
      } else {
        // Assume it's a decimal separator (e.g. "150.50" or "150,50")
        sClean = sClean.replace(/,/g, ".");
      }
    }

    const parsed = parseFloat(sClean);
    return isNaN(parsed) ? 0 : parsed;
  } catch (e) {
    return 0;
  }
}


/**
 * Format date for display
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

/**
 * Calculate nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Generate star rating display
 */
export function getStarRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    "★".repeat(fullStars) +
    (hasHalf ? "½" : "") +
    "☆".repeat(5 - fullStars - (hasHalf ? 1 : 0))
  );
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string = "USD"): string {
  try {
    return (0)
      .toLocaleString("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/\d/g, "")
      .trim();
  } catch (e) {
    return currency === "TRY" ? "₺" : "$";
  }
}

/**
 * Standardize vendor/OTA names for consistent UI display
 */
export function normalizeVendor(vendor: string | null | undefined): string {
  if (!vendor) return "Other";
  
  const v = vendor.toString().toLowerCase().trim();
  
  // Canonical Mappings
  const map: Record<string, string> = {
    "search": "Google Hotels",
    "google": "Google Hotels",
    "google search": "Google Hotels",
    "google_search": "Google Hotels",
    "google_hotels": "Google Hotels",
    "google hotels": "Google Hotels",
    "direct search": "Google Hotels",
    "booking": "Booking.com",
    "booking.com": "Booking.com",
    "expedia": "Expedia",
    "agoda": "Agoda",
    "hotels": "Hotels.com",
    "hotels.com": "Hotels.com",
    "trip": "Trip.com",
    "trip.com": "Trip.com",
    "trivago": "Trivago",
    "kayak": "Kayak",
    "tripadvisor": "Tripadvisor",
    "priceline": "Priceline",
    "otelfiyat": "OtelFiyat",
    "tatilsepeti": "TatilSepeti",
    "jolly": "Jolly",
    "otelz": "Otelz",
  };

  // Check for exact match or partial matches
  if (map[v]) return map[v];
  
  for (const [key, value] of Object.entries(map)) {
    if (v.includes(key)) return value;
  }
  
  // Fallback: Title Case
  return vendor.toString()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Maps raw DataForSEO source/vendor strings to recognizable OTA brand names */
export function resolveOtaName(raw: string | undefined | null): { name: string; type: string } {
  const name = normalizeVendor(raw);
  
  // Categorization logic
  let type = "Market Partner";
  const metaSearch = ["Google Hotels", "Trivago", "Tripadvisor", "Kayak"];
  const ota = ["Booking.com", "Expedia", "Agoda", "Hotels.com", "Trip.com", "Priceline", "OtelFiyat", "TatilSepeti", "Jolly", "Otelz"];

  if (metaSearch.includes(name)) type = "Meta-Search";
  else if (ota.includes(name)) type = "OTA";

  return { name, type };
}
