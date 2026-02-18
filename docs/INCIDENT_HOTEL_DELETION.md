# Incident Report: Accidental Hotel Deletion (Ramada Balikesir)

**Date:** 2026-02-18
**Status:** Resolved
**Severity:** High (Direct User Data Loss)

## 📝 Summary
On Feb 18, the "Ramada Balikesir" hotel was accidentally deleted from the account of `tripzydevops@gmail.com`. This resulted in the user's dashboard "swapping" to the next available hotel (Hilton Garden Inn) due to an automated fallback mechanism.

## 🔍 Root Cause Analysis

### 1. The Trigger: `cleanup_hotels.py`
The backend utility script `cleanup_hotels.py` was executed. This script targeted hotels missing both `property_token` and `serp_api_id`. The Ramada entry, being a legacy or incomplete record, lacked these IDs and was purged.

### 2. The Lack of Safety Guards
*   The script did not check for active user ownership.
*   The script did not protect "Target Hotels".
*   The script performed live deletions by default without a dry-run confirmation.

### 3. The UI Swap: `analysis_service.py`
When the Target Hotel disappeared, the `analysis_service.py` fallback logic auto-promoted the first remaining hotel (Hilton) to maintain dashboard functionality, which confused the user.

## 🛠️ Resolution & Recovery
1.  **Restoration:** The hotel was re-inserted into the `hotels` table with correct `serp_api_id` and `is_target_hotel=True` using a custom recovery script.
2.  **Validation:** Verified that dashboard KPIs for Ramada are correctly loading.

## 🛡️ Prevention Measures (Safety Guards Installed)
We have hardened the [cleanup_hotels.py](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/backend/scripts/cleanup_hotels.py) with the following:
*   **Active User Immunity:** Hotels belonging to any user in the `user_profiles` table are now strictly protected, regardless of missing tokens.
*   **Target Protection:** Any hotel marked as a target is excluded from deletion.
*   **Dry Run Default:** The script now requires an explicit `--force` flag to perform deletions.
*   **Enhanced Logging:** Added "SAFE" indicators in logs to show why specific hotels were kept.

## ⚖️ Lessons Learned
"Orphaned" data cleaning must always prioritize user ownership over data completeness. Even if a record is "unusable" for scanning, it is a user asset and should only be touched with extreme caution.
