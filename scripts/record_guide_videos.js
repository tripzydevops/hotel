/**
 * Automated Video Recording Script for HotelPlus
 * 
 * Uses Playwright's headless/headed browser with built-in video capture
 * to automatically record high-definition SaaS walkthrough videos for HotelPlus features.
 * 
 * Run with:
 *   node scripts/record_guide_videos.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "https://hotelplustr.com";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "videos");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function recordTour(slug, actionsCallback) {
  console.log(`\n[REC] Starting recording for: ${slug}...`);
  const browser = await chromium.launch({
    headless: false, // Set to true for background headless capture
    slowMo: 60, // Smooth human-like pacing
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  try {
    await actionsCallback(page);
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error(`Error during recording ${slug}:`, err.message);
  }

  // Closing page saves the video
  await page.close();
  await context.close();
  await browser.close();

  console.log(`[REC] Finished recording: ${slug}. Video saved in ${OUTPUT_DIR}`);
}

async function main() {
  console.log("=== HotelPlus Automated Video Recorder ===");
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Output Directory: ${OUTPUT_DIR}\n`);

  // Tour 1: Live Dashboard & Market Pulse
  await recordTour("dashboard-grid", async (page) => {
    await page.goto(`${BASE_URL}/help`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Scroll down to the interactive blueprint
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
    await page.waitForTimeout(2000);

    // Click hotspot pins
    const pins = await page.$$("button[title*='pin'], button:has-text('①'), button:has-text('1')");
    for (const pin of pins.slice(0, 3)) {
      await pin.click();
      await page.waitForTimeout(2500);
    }
  });

  console.log("\nAll requested tour videos recorded successfully!");
}

if (require.main === module) {
  main().catch(console.error);
}
