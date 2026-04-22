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
 * Sanitize and parse price strings with commas
 */
export function parsePrice(price: string | number): number {
  if (typeof price === "number") return price;
  if (!price) return 0;
  // Strip commas and parse
  const sanitized = price.toString().replace(/,/g, "");
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
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
