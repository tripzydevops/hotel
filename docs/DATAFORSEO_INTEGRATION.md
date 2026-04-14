# DataForSEO Integration - Technical Specification

This document details the low-level integration between the Antigravity Backend and the DataForSEO API, focusing on the asynchronous hotel search pipeline.

## 1. Interaction Model: Async Polling

To handle massive market scans without hitting timeout limits, we use the **Task POST -> Task GET** workflow.

### Step 1: Submission (`task_post`)
- **Action**: Backend submits up to 100 hotels per request to `https://api.dataforseo.com/v3/merchant/google/products/task_post`.
- **Mapping**: Each hotel in the batch is assigned a `tag` containing its internal `hotel_id`.
- **Logic**: 
  ```python
  payload = [{
      "language_code": "tr",
      "location_name": "Turkey",
      "keyword": hotel["name"],
      "tag": str(hotel["id"])
  } for hotel in batch]
  ```

### Step 2: Verification (`tasks_ready`)
- **Action**: During the next "Heartbeat" (4 hours later), the system calls `merchant/google/products/tasks_ready`.
- **Filtering**: We only retrieve tasks that match our internal tracking IDs (`scan_task` table).

### Step 3: Retrieval (`task_get`)
- **Action**: For each ready task, we call `merchant/google/products/task_get/{id}` to pull the raw JSON.
- **Normalization**: The standard `DataForSEOProvider` transforms this JSON into the unified `MonitorResult` schema.

## 2. Localization & Normalization

DataForSEO is sensitive to character encoding. To ensure 100% success rates for Turkish properties, we apply the following:

| Original | Normalized | Reason |
|----------|------------|--------|
| `ı`      | `i`        | Prevents ASCII-related keyword mismatches |
| `ş`      | `s`        | Standardizes search tokens |
| `ğ`      | `g`        | Improves matching across OTAs |

## 3. Rate Limiting & Error Handling

- **Simultaneous Tasks**: Capped at 2000 per user account by default.
- **Retry Policy**: If a task fails (e.g., "Invalid Location"), the system marks it as `failed` in `scan_tasks` and attempts a "Fuzzy Search" by stripping property suffixes (e.g., "Hotel", "Resort") in the next cycle.

---
*Document Version 1.0 - April 2026*
