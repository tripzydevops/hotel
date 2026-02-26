
# System Functional Blueprint: Frontend-to-Backend Lifecycle

This document provides a detailed map of the major functions within the platform, explaining what happens in the User Interface (Frontend) and what happens in the Service Layer (Backend) during key operations.

---

## 1. Dashboard & KPI Intelligence
**Component:** `DashboardPage`  
**Backend Service:** `dashboard_service.py`

### Function: `getDashboard` (`api.getDashboard`)
- **Frontend Action:** Triggered on dashboard mount. The UI displays "loading states" for KPI cards and the scan history table. It holds the user's currency preference for display conversion.
- **Backend Logic (`get_dashboard_logic`):** 
    1. **Parallel Fetching:** Uses `asyncio.gather` to concurrently fetch the User Profile, Settings, Unread Alerts, and the full Hotel list.
    2. **Scan History:** Queries the `price_logs` table filtered by the user's active property IDs to show the most recent 10 price updates.
    3. **KPI Synthesis:** Aggregates current prices, ratings, and market positions into a single payload for the high-reasoning Dashboard summaries.

### Function: `NeuralFeed` (`api.getAdminFeed`)
- **Frontend Action:** Displays a scrolling "Neural Feed" of background activity.
- **Backend Logic (`get_admin_feed_logic`):** Fetches recent `reasoning_logs` and `scan_sessions` to show a "live" trace of agent operations (e.g., "Scanning property X...", "Rate limit rotation triggered").

---

## 2. Rate Intelligence (Calendar)
**Component:** `CalendarPage` -> `RateIntelligenceGrid`  
**Backend Service:** `analysis_service.py`

### Function: `getAnalysisWithFilters` (`api.getAnalysisWithFilters`)
- **Frontend Action:** Triggered when the user navigates the calendar or changes filters (Room Type, Competitors). The UI updates the 14-day grid and the "Intraday Story" tooltips.
- **Backend Logic (`perform_market_analysis`):**
    1. **Semantic Matching (`get_price_for_room`):** Uses weighted string matching to find the "Standard" or "Deluxe" room price from raw scan JSON.
    2. **Market Averaging:** Calculates the daily average price of all selected competitors to determine the "VS Market" trend percentage.
    3. **Intraday Filtering:** Scans daily logs to identify the **Highest**, **Lowest**, and **Last** prices to populate the "Market Story" tooltip without cluttering.
    4. **Smart Continuity:** If a specific day has no scan, the backend "looks back" up to 7 days to provide a high-confidence estimate.

---

## 3. Monitoring & Scraper Mesh
**Component:** `ScansPanel` / `ForceScanButton`  
**Backend Service:** `monitor_service.py` & `scraper_agent.py`

### Function: `triggerMonitor` (`api.triggerMonitor`)
- **Frontend Action:** User clicks "Scan Now". The UI immediately creates a "Scan Session" in the progress side-panel and starts listening for status updates.
- **Backend Logic (`trigger_monitor_logic`):** Spawns a background task (`run_monitor_background`) to avoid blocking the API. Initializes a UUID session in the `scan_sessions` table.

### Function: `run_scan` (Scraper Agent)
- **Frontend Action:** (Indirect) Status bars move as agents report "Fetching serp_api_id...".
- **Backend Logic:**
    1. **Cache Check (`_check_global_cache`):** Verifies if this hotel was scanned by *any* user in the last 3 hours (GlobalPulse) to save API credits.
    2. **Provider Rotation:** Uses the `ProviderFactory` to rotate SerpApi keys if a 429 error occurs.
    3. **Data Extraction:** Parses the Google Hotels entity page into structured JSON (rooms, prices, vendors).
    4. **Analysis Hand-off:** Passes raw results to the `AnalystAgent` for validation and storage.

---

## 4. Admin Operations & System Health
**Component:** `AdminDashboard` / `AdminDirectory`  
**Backend Service:** `admin_service.py`

### Function: `getAdminUsers` (`api.getAdminUsers`)
- **Frontend Action:** Displays a searchable list of all users, their subscription plans, and total property counts.
- **Backend Logic (`get_admin_users_logic`):** Aggregates data from `user_profiles`, `hotels`, and `price_logs` to provide a high-level view of system adoption and activity.

### Function: `getApiKeyStatus` (`api.getApiKeyStatus`)
- **Frontend Action:** Displays "Network Providers" status, showing which API keys are active, rate-limited, or exhausted.
- **Backend Logic (`get_api_key_status_logic`):** Queries the global `providers` state to show remaining credits and provides a "Force Rotate" trigger (`force_rotate_api_key_logic`) to manually bypass stuck keys.

### Function: `syncHotelDirectory` (`api.syncHotelDirectory`)
- **Frontend Action:** Admin triggers a "Directory Sync". Shows a progress bar.
- **Backend Logic (`sync_hotel_directory_logic`):** Performs bi-directional synchronization between the user's `hotels` table and the global `hotel_directory`. Ensures all property tokens (`serp_api_id`) are valid and deduplicated.

---

## 5. Enterprise Reporting & Exports
**Component:** `ReportsPage`  
**Backend Service:** `admin_service.py` / `analysis_service.py`

### Function: `getReports` (`api.getReports`)
- **Frontend Action:** Displays annual/monthly trends, competitor "Battlefields", and KPI distributions.
- **Backend Logic (`get_reports_logic`):** Pulls longitudinal data from `price_logs` across multiple dates to calculate ADR (Average Daily Rate) and RevPAR proxies.

### Function: `exportReport` (`api.exportReport`)
- **Frontend Action:** User clicks "Download CSV/Excel".
- **Backend Logic (`export_report_logic`):** Generates a dynamic CSV stream by flattening nested price log JSON into a tabular format suitable for spreadsheet analysis.
