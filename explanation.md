# Restart Recovery Mechanism

This document explains the "Restart Recovery" mechanism implemented in the Hotel Rate Monitor backend.

## Overview

The system includes a fallback mechanism to "recover" scan sessions that may have been lost due to:

1.  **Server Crashes/Restarts:** If the server restarts while a scan is in progress or before the session is fully committed.
2.  **Legacy Data:** Older scan logs that were created before the formal `scan_sessions` table was introduced.

## How It Works

The logic is located in `backend/main.py`, specifically within the `GET /api/reports/{user_id}` endpoint.

### 1. Orphaned Log Detection

The system queries the `query_logs` table for "monitor" actions that have **NO** associated `session_id`.

```python
orphaned_result = db.table("query_logs") \
    .select("*") \
    .eq("user_id", str(user_id)) \
    .eq("action_type", "monitor") \
    .is_("session_id", "null") \  # Critical: Finds logs without a session
    .order("created_at", desc=True) \
    .limit(200) \
    .execute()
```

### 2. Session Synthesis (Grouping)

These orphaned logs are then grouped into "Legacy Sessions" based on their timestamps.

- **Window:** Logs occurring within a **5-minute window** of each other are grouped together.
- **Synthesis:** A mock session object is created for each group using `synthesize_session()`.

### 3. Merging

These synthesized legacy sessions are merged with the real `scan_sessions` retrieved from the database, ensuring that users can still see their history even if the session metadata was lost or wasn't created (legacy).

## Verification

The correctness of this recovery logic is verified by the test script:
`backend/tests/verify_legacy_recovery.py`

This script:

1.  Calls `GET /api/reports/{user_id}`.
2.  Checks for the presence of sessions with `session_type="legacy"`.
3.  Confirms that the system successfully recovered ("synthesized") these sessions from the raw logs.
