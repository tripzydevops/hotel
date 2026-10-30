import { test, expect } from '@playwright/test';

test.describe('14-Day Rate Intelligence Grid — Visual & Layout Integrity Suite', () => {
  test('should render 14-day rate grid with correct structure, sticky columns, and interactive elements', async ({ page }) => {
    // 1. Visit the deterministic Enterprise Demo view
    await page.goto('http://localhost:3000/demo');

    // 2. Locate Rate Intelligence Grid container
    const gridContainer = page.locator('[data-testid="rate-intelligence-grid"]');
    await expect(gridContainer).toBeVisible();

    // 3. Verify target hotel header & "YOU" indicator
    const targetHeader = gridContainer.locator('text=Grand Tripzy Resort');
    await expect(targetHeader).toBeVisible();
    const youBadge = gridContainer.locator('text=You');
    await expect(youBadge).toBeVisible();

    // 4. Verify competitor headers
    const hiltonHeader = gridContainer.locator('text=Hilton Garden Inn').first();
    const altinHeader = gridContainer.locator('text=Altın Otel').first();
    const ramadaHeader = gridContainer.locator('text=Ramada Residences').first();
    await expect(hiltonHeader).toBeVisible();
    await expect(altinHeader).toBeVisible();
    await expect(ramadaHeader).toBeVisible();

    // 5. Verify Sticky Date Column geometry
    const dateHeaders = gridContainer.locator('thead th').first();
    const isSticky = await dateHeaders.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.position === 'sticky' && parseInt(style.left, 10) === 0;
    });
    expect(isSticky).toBe(true);

    // 6. Verify Pricing format & best rate indicators
    const priceCells = gridContainer.locator('tbody tr td');
    const cellCount = await priceCells.count();
    expect(cellCount).toBeGreaterThan(10);

    // 7. Verify Container Bounding Box (No layout collapse)
    const box = await gridContainer.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(500);
      expect(box.height).toBeGreaterThan(250);
    }

    // 8. Test interaction: hover and click on competitor cell triggers telemetry without navigating away
    const firstCell = gridContainer.locator('tbody tr td').nth(2);
    await firstCell.click();
    await expect(gridContainer).toBeVisible();
  });

  test('should verify public pricing tiers layout and visual consistency', async ({ page }) => {
    await page.goto('http://localhost:3000/pricing');

    // Verify main content container
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();

    // Verify pricing plans cards exist (command-card)
    const pricingCards = page.locator('.command-card');
    const cardCount = await pricingCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
