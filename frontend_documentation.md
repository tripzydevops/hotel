# Frontend Functionality Guide: Hotel Rate Sentinel

This document outlines the key features and functions of the frontend application, organized by module.

## 1. 🏠 Dashboard (Overview)
**Path:** `/`
The command center for the user.
-   **At a Glance Stats:** Shows real-time metrics like "Average Price", "Parity Score", and "Active Alerts".
-   **Hotel Switcher:** Allows users to toggle between different properties they manage.
-   **Quick Actions:** Shortcuts to "Add Hotel" or "Trigger Scan".

## 2. 📊 Market Analysis
**Path:** `/analysis`
Deep dive into pricing trends and competitive intelligence.
-   **Overview:** General market health and price positioning.
-   **Rate Calendar:** A visual heatmap of prices over time. Shows your price vs. competitors for specific dates.
-   **Discovery:** Uses AI (Vector Search) to find new competitors based on similarities (amenities, location, star rating).
-   **Sentiment:** Analyzes guest reviews (Cleanliness, Service, Location) to show how you stack up against the market sentiment.

## 3. 🏨 Hotel Management
**Feature:** "Add Hotel Modal" & Settings
-   **Universal Search:** Finds hotels from the global directory. If a hotel isn't found locally, it falls back to a live Google Search (SerpApi).
-   **Auto-Sync:** data entered here (images, coordinates) is automatically contributed back to the global directory.
-   **Settings:** Configure preferred currency, tax rates, and alert thresholds.

## 4. ⚖️ Parity Monitor
**Path:** `/parity-monitor`
Ensures your hotel's direct price is competitive.
-   **Channel Comparison:** Pits your direct booking price against OTAs (Booking.com, Expedia, etc.).
-   **Alerts:** Highlights dates where you are being undercut by third parties.

## 5. 📑 Reports
**Path:** `/reports`
Exportable data for stakeholders.
-   **PDF/CSV Exports:** Generate downloadable reports of your pricing history.
-   **Scheduled Reports:** (Admin) Configure automatic report generation variables.

## 6. 🛡️ Admin Console
**Path:** `/admin`
System management for super-users.
-   **User Management:** Create/Delete users and manage subscription plans.
-   **Directory Sync:** Manually trigger a sync between local hotel data and the global directory.
-   **System Health:** Monitor SerpApi quota usage, rotate API keys, and view system logs.
-   **Market Intelligence:** A "God Mode" view to see pricing data for any city without setting up a specific monitor.
