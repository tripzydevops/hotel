/**
 * Unit Tests for Rate Sentinel Pricing, Currency, and Room Normalization
 * Run with: node --experimental-strip-types tests/pricing_and_normalization.test.ts
 */

import { parsePrice, formatCurrency, cn } from '../lib/utils.ts';
import { getStandardizedRoomCategory } from '../utils/roomNormalization.ts';

let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — Expected: ${expected}, Got: ${actual}`);
    failed++;
  }
}

console.log('\n💵 Pricing Parsing Tests (parsePrice):');
assertEqual('Parses standard integer string', parsePrice('150'), 150);
assertEqual('Parses float string', parsePrice('149.99'), 149.99);
assertEqual('Parses US currency formatted string "$1,250.00"', parsePrice('$1,250.00'), 1250);
assertEqual('Parses European/Turkish formatted string "3.825,50 €"', parsePrice('3.825,50 €'), 3825.5);
assertEqual('Parses Turkish comma decimal "150,50 TL"', parsePrice('150,50 TL'), 150.5);
assertEqual('Parses thousand dot separator "3.825"', parsePrice('3.825'), 3825);
assertEqual('Handles null safely', parsePrice(null), 0);
assertEqual('Handles undefined safely', parsePrice(undefined), 0);
assertEqual('Handles empty string safely', parsePrice(''), 0);
assertEqual('Handles already numeric input', parsePrice(299.9), 299.9);

console.log('\n💱 Currency Formatting Tests (formatCurrency):');
assertEqual('Formats USD integer correctly', formatCurrency(150, 'USD', 'en-US'), '$150');
assertEqual('Formats string number correctly', formatCurrency('250', 'USD', 'en-US'), '$250');

console.log('\n🏨 Room Category Normalization Tests (getStandardizedRoomCategory):');
assertEqual('Normalizes "Executive King Suite" -> Suite', getStandardizedRoomCategory('Executive King Suite'), 'Suite');
assertEqual('Normalizes "Junior Süit" (TR) -> Suite', getStandardizedRoomCategory('Junior Süit'), 'Suite');
assertEqual('Normalizes "Balayı Odası" (TR Honeymoon) -> Suite', getStandardizedRoomCategory('Balayı Odası'), 'Suite');
assertEqual('Normalizes "Family Sea View" -> Family', getStandardizedRoomCategory('Family Sea View'), 'Family');
assertEqual('Normalizes "Geniş Aile Odası" (TR) -> Family', getStandardizedRoomCategory('Geniş Aile Odası'), 'Family');
assertEqual('Normalizes "Deluxe Double City View" -> Deluxe', getStandardizedRoomCategory('Deluxe Double City View'), 'Deluxe');
assertEqual('Normalizes "Superior Room" -> Deluxe', getStandardizedRoomCategory('Superior Room'), 'Deluxe');
assertEqual('Normalizes "Standard Twin Bed" -> Standard', getStandardizedRoomCategory('Standard Twin Bed'), 'Standard');
assertEqual('Normalizes "Klasik Oda" (TR Classic) -> Standard', getStandardizedRoomCategory('Klasik Oda'), 'Standard');
assertEqual('Normalizes unclassified name to Standard fallback (Run of House)', getStandardizedRoomCategory('Treehouse Eco Pod'), 'Standard');

console.log('\n🎨 Tailwind Class Merging Tests (cn):');
assertEqual('Combines class names cleanly', cn('btn', 'btn-primary'), 'btn btn-primary');
assertEqual('Resolves conflicting Tailwind classes', cn('p-4', 'p-6'), 'p-6');
assertEqual('Handles conditional classes', cn('base', false && 'hidden', true && 'block'), 'base block');

console.log(`\n──────────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✅ All unit tests passed!`);
}
