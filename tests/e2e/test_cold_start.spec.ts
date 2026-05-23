import { test, expect } from '@playwright/test';

test.describe('Cold Start Flow', () => {
  test('should batch user signals on amenity click', async ({ page }) => {
    // Navigate to a hotel detail page
    await page.goto('http://localhost:3000/hotel/123');

    // Wait for the amenities tab to load
    const amenitiesTab = page.locator('role=tab[name="Amenities"]');
    await expect(amenitiesTab).toBeVisible();
    await amenitiesTab.click();

    // Click on a specific amenity (e.g., Spa) to trigger a signal
    const spaAmenity = page.locator('text=Luxury Spa');
    await expect(spaAmenity).toBeVisible();
    
    // Intercept the batch-signals API call
    const batchRequestPromise = page.waitForRequest(
      request => request.url().includes('/api/batch-signals') && request.method() === 'POST'
    );
    
    await spaAmenity.click();
    
    // In a real app, signals are batched and sent periodically or on unmount
    // For testing, we might trigger a flush or wait for the interval
    // Here we wait for the network request to ensure it fired
    const batchRequest = await batchRequestPromise;
    const postData = batchRequest.postDataJSON();
    
    expect(postData.signals.length).toBeGreaterThan(0);
    expect(postData.signals[0].signal_type).toBe('click');
    expect(postData.signals[0].payload.element).toContain('spa');
  });
});
