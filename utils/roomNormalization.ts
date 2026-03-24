
/**
 * Normalizes raw room names into standard categories.
 * This ensures the UI dropdown is clean and readable.
 */
export function getStandardizedRoomCategory(rawName: string): string {
  const lower = rawName.toLowerCase();

  // 1. Suite
  if (
    lower.includes("suite") ||
    lower.includes("süit") ||
    lower.includes("junior") ||
    lower.includes("executive") ||
    lower.includes("king suite") ||
    lower.includes("başkanlık") || // Presidential
    lower.includes("kral") || // King (Suite context)
    lower.includes("balayı") || // Honeymoon
    lower.includes("dubleks") || // Duplex
    lower.includes("loft")
  ) {
    return "Suite";
  }

  // 2. Family
  if (
    lower.includes("family") ||
    lower.includes("aile") ||
    lower.includes("connection") ||
    lower.includes("connected") ||
    lower.includes("bağlantılı") ||
    lower.includes("geniş") // Large/Spacious
  ) {
    return "Family";
  }

  // 3. Deluxe / Superior
  if (
    lower.includes("deluxe") ||
    lower.includes("superior") ||
    lower.includes("premium") ||
    lower.includes("corner") ||
    lower.includes("rezidans") ||
    lower.includes("residence") ||
    lower.includes("business") ||
    lower.includes("executive")
  ) {
    return "Deluxe";
  }

  // 4. Standard (Catch-all for basic types)
  if (
    lower.includes("standard") ||
    lower.includes("standart") ||
    lower.includes("classic") ||
    lower.includes("klasik") ||
    lower.includes("double") ||
    lower.includes("king") ||
    lower.includes("queen") ||
    lower.includes("twin") ||
    lower.includes("single") ||
    lower.includes("tek") ||
    lower.includes("çift") ||
    lower.includes("ekonomik") ||
    lower.includes("promo") ||
    lower.includes("yan oda")
  ) {
    return "Standard";
  }

  // Fallback: If it's a specific room name that doesn't fit, 
  // we can either return "Other" or the original name if it's short.
  // For dropdown cleanliness, "Other" or the raw name is fine.
  return "Standard"; // Defaulting to Standard is usually safest for "Run of House"
}
