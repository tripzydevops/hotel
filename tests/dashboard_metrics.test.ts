/**
 * Unit Tests for Dashboard Metrics & Pricing Calculations
 * Run with: node --experimental-strip-types tests/dashboard_metrics.test.ts
 */

import {
  calculateEffectiveTargetPrice,
  calculateIsLocked,
  calculateIsEnterprise,
  calculateMarketPulseAvg,
  calculateAvgCompetitorPrice,
  calculateUndercuttingCount,
  calculatePricesDroppedCount,
  resolveActiveCurrency,
} from '../utils/dashboardCalculations.ts';

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

console.log('\n🎯 Target Price Calculation (calculateEffectiveTargetPrice):');
assertEqual('Parses numeric target price', calculateEffectiveTargetPrice(4500), 4500);
assertEqual('Parses string target price with symbol', calculateEffectiveTargetPrice('$4,500.00'), 4500);
assertEqual('Handles null target price', calculateEffectiveTargetPrice(null), 0);
assertEqual('Handles undefined target price', calculateEffectiveTargetPrice(undefined), 0);

console.log('\n🔒 Account Lock Logic (calculateIsLocked):');
assertEqual('Locks past_due account', calculateIsLocked('past_due'), true);
assertEqual('Locks canceled account', calculateIsLocked('canceled'), true);
assertEqual('Locks unpaid account', calculateIsLocked('unpaid'), true);
assertEqual('Allows active subscription', calculateIsLocked('active'), false);
assertEqual('Allows trial subscription', calculateIsLocked('trialing'), false);
assertEqual('Allows null/default', calculateIsLocked(null), false);

console.log('\n👑 Enterprise Tier Qualification (calculateIsEnterprise):');
assertEqual('Admin role qualifies as enterprise', calculateIsEnterprise('admin', 'free'), true);
assertEqual('Enterprise plan qualifies', calculateIsEnterprise('member', 'enterprise'), true);
assertEqual('Case-insensitive plan check', calculateIsEnterprise('member', 'Enterprise'), true);
assertEqual('Pro plan qualifies', calculateIsEnterprise('member', 'pro'), true);
assertEqual('Trial plan qualifies', calculateIsEnterprise('member', 'trial'), true);
assertEqual('Starter plan does not qualify', calculateIsEnterprise('member', 'starter'), false);
assertEqual('Free plan does not qualify', calculateIsEnterprise('member', 'free'), false);

console.log('\n📈 Market Pulse Average (calculateMarketPulseAvg):');
assertEqual('Averages positive and negative deltas', calculateMarketPulseAvg([10, -5, 15, -10]), 2.5);
assertEqual('Handles empty competitor list', calculateMarketPulseAvg([]), 0);
assertEqual('Handles undefined/null deltas gracefully', calculateMarketPulseAvg([5, null, 15]), (5 + 0 + 15) / 3);

console.log('\n💰 Competitor Average Price (calculateAvgCompetitorPrice):');
assertEqual('Calculates average and rounds correctly', calculateAvgCompetitorPrice([1000, 2000, 3000]), 2000);
assertEqual('Ignores zero prices ($0 free/unlisted)', calculateAvgCompetitorPrice([1000, 0, 3000]), 2000);
assertEqual('Ignores negative or malformed prices', calculateAvgCompetitorPrice([2500, null, 'invalid']), 2500);
assertEqual('Returns 0 for empty array', calculateAvgCompetitorPrice([]), 0);

console.log('\n📉 Undercutting Competitors (calculateUndercuttingCount):');
assertEqual(
  'Counts competitors priced strictly below target price',
  calculateUndercuttingCount([3500, 4200, 3800, 5000], 4000),
  2
);
assertEqual('Ignores zero prices from undercutting count', calculateUndercuttingCount([0, 3800], 4000), 1);
assertEqual('Does not count equal price as undercut', calculateUndercuttingCount([4000], 4000), 0);

console.log('\n📉 Price Drop Trends (calculatePricesDroppedCount):');
assertEqual('Counts only downward trends', calculatePricesDroppedCount(['down', 'up', 'down', 'stable']), 2);
assertEqual('Handles empty or non-down trends', calculatePricesDroppedCount(['up', 'stable']), 0);

console.log('\n💱 Currency Resolution Cascade (resolveActiveCurrency):');
assertEqual('User preference takes priority', resolveActiveCurrency('EUR', 'USD', 'TRY'), 'EUR');
assertEqual('Target hotel currency is second in cascade', resolveActiveCurrency(null, 'USD', 'TRY'), 'USD');
assertEqual('Competitor currency is third in cascade', resolveActiveCurrency(null, null, 'GBP'), 'GBP');
assertEqual('Defaults to TRY if all missing', resolveActiveCurrency(null, null, null), 'TRY');

console.log(`\n──────────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`All dashboard metrics tests passed! 🎉\n`);
}
