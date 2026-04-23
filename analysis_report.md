# Analysis of Background Scan Implementation vs Documentation

Based on a review of the background scanning architecture documentation (`docs/PRICE_MONITORING_SYSTEM.md`) and the actual backend implementation (`backend/services/monitor_service.py`, `backend/services/scan_persistence.py`, `backend/services/providers/dataforseo_provider.py`), the following discrepancies and missing features have been identified:

## 1. Trigger / Cron Schedule Mismatch
- **Documentation (`docs/PRICE_MONITORING_SYSTEM.md`)**: States the "System Heartbeat" triggers "Every 4 hours (`SCAN_PULSE_INTERVAL_HOURS`) via GitHub Action Cron."
- **Implementation**:
  - `SCAN_PULSE_INTERVAL_HOURS` is indeed `4` (in `schemas.py`).
  - However, `.github/workflows/scheduler.yml` runs every 5 minutes (`cron: "*/5 * * * *"`), not 4 hours. It triggers `run_scheduler.py` which runs `run_scheduler_check_logic`. Inside `run_scheduler_check_logic`, it checks `admin_settings` for `last_global_scan_at` to enforce the 4-hour limit for *submitting* new tasks.
  - While the *effect* of generating scans might be bounded to 4 hours, the cron job itself does not run every 4 hours, meaning it's misleadingly documented or misconfigured in the GitHub action.

## 2. 5-Day Baseline for Variance Checks
- **Documentation**: "Variance Checks: Flags prices deviating by > 30% from the verified 5-day baseline."
- **Implementation**:
  - In `backend/services/scan_persistence.py` (`_fetch_history_map`), it queries history using `limit(len(hotel_ids) * 5)`. This is a limit on the *count* of records returned, not a time-bounded "5-day baseline".
  - If a hotel hasn't been scanned for a month, it will just retrieve the last 5 logs whenever they happened. There is no filter in the DB query for `recorded_at > (now - 5 days)`. Thus, the "5-day" baseline is currently implemented as a "last 5 records" baseline, which fails to represent actual time recency.

## 3. Asynchronous Batch Dispatching
- **Documentation**: "Identifies properties needing a 'Pulse' check and dispatches them in Batches of 100."
- **Implementation**:
  - `DataForSEOProvider.submit_hotel_scan_batch` correctly splits submissions into chunks of 100 before calling `post_price_tasks`.
  - *No missing feature here*, it's correctly aligned.

## 4. Normalization and Transliteration
- **Documentation**: "Transliterates Turkish characters (ı -> i, ş -> s) to satisfy API constraints."
- **Implementation**:
  - `DataForSEOProvider._normalize_location` applies `_TURKISH_CHAR_MAP` correctly to transliterate chars.
  - *No missing feature here*, it's correctly implemented.

## 5. Price Floors
- **Documentation**: "Price Floors: Rejects unrealistic rates (e.g., < 3000 TRY for a Ramada)."
- **Implementation**:
  - `ScanPersistenceService._process_hotel_entry` includes a heuristic for Brands (`ramada: 3000.0`, `hilton: 3000.0`, etc) and a global absolute minimum of `200.0` TRY.
  - *No missing feature here*, it's implemented.

## 6. Smart Continuity / Fallbacks
- **Documentation**: "If a scan fails or returns zero, uses the most recent valid historical price to maintain a continuous graph."
- **Implementation**:
  - Yes, `ScanPersistenceService._process_hotel_entry` uses `next((h for h in history if str(h.get("check_in_date")) == check_in_str), None)` or the most recent historical entry if current price is `<= 0`.
  - *No missing feature here*.

## Summary
The major missing piece is the strict enforcement of the **5-day timeframe** for the variance baseline calculation in `ScanPersistenceService`. Currently, the code mistakenly relies on a SQL `.limit()` representing an item count, rather than a temporal date filter for 5 days. Additionally, the GitHub Action Cron runs every 5 minutes rather than 4 hours, handling the 4-hour interval logic internally in the database rather than at the trigger level.
