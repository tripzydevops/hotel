
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
    lower.includes("king suite")
  ) {
    return "Suite";
  }

  // 2. Family
  if (
    lower.includes("family") ||
    lower.includes("aile") ||
    lower.includes("connection") ||
    lower.includes("connected")
  ) {
    return "Family";
  }

  // 3. Deluxe / Superior
  if (
    lower.includes("deluxe") ||
    lower.includes("superior") ||
    lower.includes("premium") ||
    lower.includes("corner")
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
    lower.includes("king") || // Often King Room is just a standard room with big bed
    lower.includes("queen") ||
    lower.includes("twin") ||
    lower.includes("single") ||
    lower.includes("tek") ||
    lower.includes("çift")
  ) {
    return "Standard";
  }

  // Fallback: If it's a specific room name that doesn't fit, 
  // we can either return "Other" or the original name if it's short.
  // For dropdown cleanliness, "Other" or the raw name is fine.
  return "Standard"; // Defaulting to Standard is usually safest for "Run of House"
}
