import { test, expect } from '@playwright/test';

test.describe('WCAG 2.1 AA / ADA Accessibility Audit', () => {
  test('should feature Skip to Main Content links and focus landmarks', async ({ page }) => {
    // 1. Visit Landing Page
    await page.goto('http://localhost:3000/');

    // Assert that the skip link is present in the DOM
    const skipLink = page.locator('text=Skip to main content');
    await expect(skipLink).toBeAttached();

    // Verify it uses the screen-reader-only (sr-only) class by default
    const classes = await skipLink.getAttribute('class');
    expect(classes).toContain('sr-only');

    // 2. Visit Dashboard & Verify main-content target exists
    await page.goto('http://localhost:3000/dashboard');
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeAttached();

    // Verify the main content element has tabIndex={-1} for programmatic focus shift
    const tabIndex = await mainContent.getAttribute('tabIndex');
    expect(tabIndex).toBe('-1');

    // 3. Verify Accessibility Statement page is fully reachable
    await page.goto('http://localhost:3000/accessibility');
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText(/Accessibility|Erişilebilirlik/);
  });
});
