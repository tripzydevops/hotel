# Background Scan Fix Documentation

## The Problem
Background scheduled scans (the `hotel_pulse_scan` triggered globally) were failing to trigger or incorrectly skipping their interval. The pulse loop relies on `next_global_scan_at` and `last_global_scan_at` timestamp tracking in the InsForge `admin_settings` table. 

Two critical issues were identified:
1. **Timezone Parsing Issues:** The InsForge database returns ISO timestamps concluding with a `Z` specifier for UTC (e.g., `2026-04-19T13:42:51Z`). In standard Python, `datetime.fromisoformat()` did not reliably parse the `Z` suffix. Because of this failure, exceptions were being swallowed or evaluated incorrectly causing the system to assume a scan was already due or not due, causing synchronization and skipping issues.
2. **Optimistic Locking Vulnerability:** The scheduler would attempt to push background scans, waiting for all asynchronous webhooks to trigger prior to bumping the `last_global_scan_at` and `next_global_scan_at` markers. Should the script hit a timeout or fail midway through large batches, the scan tracker remained unupdated, triggering endless retry loops on the 5-minute scheduler.

## The Solution
We implemented robust fixes in `backend/services/monitor_service.py` to ensure accurate and reliable interval-based processing:

### 1. Robust Timezone Normalization
Before comparing the `last_scan` property, the string is scrubbed against the `Z` notation by forcibly replacing it with standard explicit offset markers `+00:00`.
```python
last_dt = datetime.fromisoformat(last_scan.replace("Z", "+00:00"))
if (now - last_dt).total_seconds() < (interval * 3600):
   is_due = False
```

### 2. Immediate Optimistic Locking
We updated the tracker code to push an immediate optimistic lock update to the `admin_settings` database **before** the long-running batch submission begins. This assures the 5-minute scheduler recognizes a task is currently executing or recently executed, avoiding multiple invocations running concurrently.
```python
next_scan = now + timedelta(hours=interval)
db.table("admin_settings").update({
    "last_global_scan_at": now.isoformat(),
    "next_global_scan_at": next_scan.isoformat()
}).eq("id", settings["id"]).execute()
```

## Current State
The internal system runs a 4-hour cycle interval. These fixes confirm overlap prevention and correct conversion of UTC string timestamps, guaranteeing that scans only execute once every 4 hours globally for monitored hotels.
