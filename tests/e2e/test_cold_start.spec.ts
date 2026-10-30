import { test, expect } from '@playwright/test';

test.describe('Public Navigation & Discovery Flow', () => {
  test('should navigate between landing, pricing, and help center cleanly', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveTitle(/Hotel Rate Sentinel/);

    // 2. Navigate to Pricing
    await page.goto('http://localhost:3000/pricing');
    const pricingHeading = page.locator('h1, h2').first();
    await expect(pricingHeading).toBeVisible();

    // 3. Visit Help Center
    await page.goto('http://localhost:3000/help');
    const helpContainer = page.locator('body');
    await expect(helpContainer).toBeVisible();
  });
});
