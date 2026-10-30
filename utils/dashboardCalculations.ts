/**
 * Pure calculation functions for Dashboard metrics and Price Parsing.
 * Zero-dependency module for universal compatibility across Next.js, Edge, and Node test runners.
 */

/**
 * Sanitize and parse price strings with international format support (commas/dots).
 */
export function parsePrice(price: string | number | null | undefined): number {
  if (typeof price === "number") return price;
  if (price === null || price === undefined || price === "") return 0;

  try {
    const s = price.toString().trim();
    let sClean = s.replace(/[^\d.,-]/g, "");

    if (sClean.includes(".") && sClean.includes(",")) {
      if (sClean.lastIndexOf(",") > sClean.lastIndexOf(".")) {
        sClean = sClean.replace(/\./g, "").replace(/,/g, ".");
      } else {
        sClean = sClean.replace(/,/g, "");
      }
    } else if (sClean.includes(".") || sClean.includes(",")) {
      const lastSepIdx = Math.max(sClean.lastIndexOf("."), sClean.lastIndexOf(","));
      const trailingDigits = sClean.length - lastSepIdx - 1;

      if (trailingDigits === 3) {
        sClean = sClean.replace(/\./g, "").replace(/,/g, "");
      } else {
        sClean = sClean.replace(/,/g, ".");
      }
    }

    const parsed = parseFloat(sClean);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

export function calculateEffectiveTargetPrice(targetPrice: string | number | undefined | null): number {
  return parsePrice(targetPrice || 0);
}

export function calculateIsLocked(subscriptionStatus?: string | null): boolean {
  return (
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "unpaid"
  );
}

export function calculateIsEnterprise(role?: string | null, planType?: string | null): boolean {
  const normalizedPlan = (planType || "").toLowerCase();
  return (
    role === "admin" ||
    normalizedPlan === "enterprise" ||
    normalizedPlan === "pro" ||
    normalizedPlan === "trial"
  );
}

export function calculateMarketPulseAvg(competitorChanges: (number | undefined | null)[]): number {
  if (!competitorChanges.length) return 0;
  const total = competitorChanges.reduce<number>((acc, val) => acc + (val || 0), 0);
  return total / competitorChanges.length;
}

export function calculateAvgCompetitorPrice(prices: (string | number | undefined | null)[]): number {
  const validPrices = prices.map((p) => parsePrice(p || 0)).filter((p) => p > 0);
  if (!validPrices.length) return 0;
  return Math.round(validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length);
}

export function calculateUndercuttingCount(
  competitorPrices: (string | number | undefined | null)[],
  targetPrice: number
): number {
  return competitorPrices.filter((p) => {
    const parsed = parsePrice(p || 0);
    return parsed > 0 && parsed < targetPrice;
  }).length;
}

export function calculatePricesDroppedCount(trends: (string | undefined | null)[]): number {
  return trends.filter((t) => t === "down").length;
}

export function resolveActiveCurrency(
  userCurrency?: string | null,
  targetCurrency?: string | null,
  competitorCurrency?: string | null
): string {
  return userCurrency || targetCurrency || competitorCurrency || "TRY";
}
