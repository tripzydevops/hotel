# Plan: Fix Rate Calendar Fragmentation (Duplicate Targets)

The Rate Calendar currently shows "N/A" for the Ramada hotel because the user has three duplicate records for it. The backend maps incoming price data to the *last* duplicate ID, but selects the *first* duplicate ID as the active "target" for the dashboard.

## Proposed Changes

### [Backend] Analysis Service

#### [MODIFY] [analysis_service.py](file:///home/tripzydevops/hotel/backend/services/analysis_service.py)
- **Unify Mapping & Selection**: Refactor `get_market_intelligence_data` to ensure that when multiple local hotels share a `serp_api_id`, logs are mapped to the hotel currently designated as the "Active Target" (if one exists).
- **Hardened Selection**: Ensure `perform_market_analysis` uses a consistent selection priority for target hotels if multiple are mistakenly marked as `is_target_hotel`.

### [Backend] Cleanup Utility

#### [NEW] [dedupe_hotels.py](file:///home/tripzydevops/hotel/backend/scripts/dedupe_hotels.py)
- **Automatic De-duplication**: Script to identify hotels sharing the same `user_id` and `serp_api_id`.
- **Log Migration**: Move any `price_logs` from duplicate records to the primary record before deleting/marking duplicates as deleted.
- **Safety**: Preserve the record with the most history or the most recent `updated_at` timestamp.

## Verification Plan

### Automated Verification
1. **Reproduction Script**: Create [repro_dupes.py](file:///home/tripzydevops/hotel/tests/repro_dupes.py) that manually creates a duplicate target hotel and verifies the fragmentation "N/A" state.
2. **Fix Validation**: Run `repro_dupes.py` after the code changes to verify that data is correctly merged into the analysis response.
   ```bash
   export $(cat .env | xargs) && ./venv/bin/python3 tests/repro_dupes.py
   ```

### Manual Verification
- **Dashboard Check**: Verify that the Rate Calendar for Ramada no longer shows "N/A" for historical February dates.
- **Admin Panel**: Check the Admin Panel to ensure only one Ramada instance is visible after running the dedupe script.
