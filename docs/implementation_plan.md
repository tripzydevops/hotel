# Plan: Fix Rate Calendar "N/A" and Missing Competitors

The previous fix addressed hotel record duplication, but Price Data is still not rendering correctly for the target hotel or most competitors. Investigation reveals that `query_logs` (legacy) contains the January/February data, but the current filtering logic in `get_price_for_room` is too strict for logs with empty `room_types`.

## Proposed Changes

### [Backend] Analysis Service

#### [MODIFY] [analysis_service.py](file:///home/tripzydevops/hotel/backend/services/analysis_service.py)
- **Legacy Room Fallback**: Update `get_price_for_room` to always fall back to the top-level `price` field if `room_types` is empty, even for non-standard requests, IF no other data is available. This ensures historical continuity.
- **Competitor Mapping Fix**: Ensure that competitor hotel IDs are correctly matched across both `price_logs` and `query_logs` regardless of minor name variations.
- **Expand Search Window**: Ensure data gathering correctly pulls from `query_logs` for any gaps in `price_logs` all the way back to January.

### [Backend] Data Migration

#### [MODIFY] [dedupe_hotels.py](file:///home/tripzydevops/hotel/backend/scripts/dedupe_hotels.py)
- **Multi-Account Deduplication**: Update the script to handle duplicates across different `user_id`s (e.g., merging `askin` and `tripzydevops` logs for the same hotel).
- **Comprehensive Migration**: Migrate all valid historical records for all 5 hotels from `query_logs` to `price_logs` to centralize the data.

## Verification Plan

### Automated Verification
1. **Reproduction Script**: Run `reproduce_calendar_bug.py` with specific checks for January/February data across all 5 hotels.
   ```bash
   export $(cat .env | xargs) && ./venv/bin/python3 reproduce_calendar_bug.py
   ```

### Manual Verification
- **Dashboard Check**: Verify that the Rate Calendar shows prices for Ramada and all 4 competitors for Feb 19 and earlier.
- **Date Navigation**: Verify that the "N/A" state is eliminated for all dates where any historical data exists.
