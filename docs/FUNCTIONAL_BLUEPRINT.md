
# System Functional Blueprint: Technical Specification (V2)

This document serves as the absolute technical reference for recreating the platform. It details the precise algorithms, data schemas, and database anchors required for each major function.

---

## 1. Dashboard & KPI Intelligence
**Component:** `DashboardPage` | **Backend Service:** `dashboard_service.py`

### Function: `getDashboard` (`api.getDashboard`)
*   **Trigger:** Dashboard mount or manual refresh.
*   **Logic Spec (`get_dashboard_logic`):**
    *   **Parallelization:** Uses `asyncio.gather` for 7 concurrent fetches (Profiles, Settings, Alerts, query_logs, price_logs, sessions, hotels).
    *   **Scan History Algorithm:** Fetches the latest 10 `price_logs` where `hotel_id` is in the user's active hotel list.
    *   **Anti-Drift Scheduler:** Calculates `next_scan_at` relative to the **intended** schedule time (stored in `profiles`) vs current time to prevent cumulative drift.
*   **Data Shape (Output):**
    ```json
    {
      "target_hotel": { "id": "uuid", "name": "string", "price_history": [{ "price": 0.0, "recorded_at": "ISO" }] },
      "competitors": [ { "id": "uuid", "name": "string", "price_info": { "current_price": 0.0 } } ],
      "scan_history": [ { "recorded_at": "ISO", "price": 0.0, "vendor": "string" } ],
      "next_scan_at": "ISO_Timestamp"
    }
    ```
*   **DB Anchors:**
    - `user_profiles` (Role-based access).
    - `price_logs` (History extraction).
    - `settings` (`check_frequency_minutes` override).

---

## 2. Rate Intelligence (Calendar)
**Component:** `RateIntelligenceGrid` | **Backend Service:** `analysis_service.py`

### Function: `getAnalysisWithFilters` (`api.getAnalysisWithFilters`)
*   **Algorithm: `_extract_price`**
    - **Turkish/EU Pattern:** Replaces "." with "" and "," with "." if both exist.
    - **Ambiguity Guard:** If only "." exists and treatable as float < 500 with 3 decimal places, treat as thousand separator (e.g., "3.825" -> 3825.0).
*   **Algorithm: `get_price_for_room`**
    - **Matching:** Local `allowed_room_names_map` check -> String variant/synonym fallback (Standard, Standart, Suite, Süit, etc.).
    - **Category Guards:** Reject "Standard" logic if user requested "Suite" or "Deluxe" unless explicitly matched.
*   **Logic Spec (`perform_market_analysis`):**
    - **Same-Date Lookback:** 7-day window searching backwards for the same check-in date if current is null.
    - **Any-Date Fallback:** Historically seeds missing days but restricted to **past or today's** dates to prevent future estimation bias.
    - **Intraday Story:** Extracts only 3 milestones: `max(price)`, `min(price)`, and `max(recorded_at)`. Deduplicates with shared labels (e.g., "High/Last").
*   **DB Anchors:**
    - `price_logs`: Queries by `hotel_id` **and** global `serp_api_id` (Pulse Data).
    - `query_logs`: Secondary fallback if `price_logs` density < 5 per hotel or request > 90 days old.

---

## 3. Monitoring & Scraper Mesh
**Component:** `ScansPanel` | **Backend Agent:** `scraper_agent.py`

### Function: `run_scan`
*   **Algorithm: GlobalPulse Caching**
    - **TTL:** 180 minutes (3 hours).
    - **Logic:** `_check_global_cache` queries the most recent `price_logs` across ALL users for the same `serp_api_id` and check-in date.
    - **Room-Type Pass-through:** If a specific room type is cached but not the primary, it extracts the sub-price from the `room_types` JSON field.
*   **Logic Spec:**
    - **Quota Management:** `admin_service` tracks monthly usage against a hardcoded 250/key limit.
    - **Zombie Cleanup:** `monitor_service` marks any session running > 120 minutes as "failed" during the daily cron check.
*   **DB Anchors:**
    - `price_logs`: `serp_api_id` + `check_in_date` + `recorded_at` > (now - 3h).
    - `scan_sessions`: Tracks `pending` -> `running` -> `completed` status lifecycle.

---

## 4. Admin & Reporting
**Component:** `AdminDashboard` | **Backend Service:** `admin_service.py`

### Function: `getAdminUsers`
*   **Table Joins:** Profile (Public) -> User_Profiles (Private) -> Settings -> Subscription Profiles.
*   **Plan Capacity Logic:** Hardcoded mapping: `starter: 5`, `pro: 25`, `enterprise: 999`.
*   **Export Logic:** Flattening `price_logs` JSON; limit set at 1000 records per CSV export for performance safety.

---

## 5. AI Reasoning & Strategic DNA
**Component:** `StrategyInsights` | **Backend Service:** `analyst_agent.py`

### Function: `generateNarrative`
*   **Algorithm: Quadrant Mapping**
    - **X-Axis:** `ARI - 100` (Price deviation).
    - **Y-Axis:** `Sentiment Index - 100` (Quality deviation).
    - **Clamping:** All values restricted to +/- 50.0 range.
*   **Data Inputs:** 90-day ADR trends, `synthesize_value_score` output (weighted ARI/Sentiment intersection).
*   **AI Persona:** "Revenue Strategy Analyst" (Gemini-3-Flash-Preview).
