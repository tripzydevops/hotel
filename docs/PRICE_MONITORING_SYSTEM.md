# Price Monitoring & Notification System (Architecture 2026)

This document provides a technical overview of the autonomous price monitoring pipeline, detailing the workflow from background execution to user notification.

## 1. Conceptual Vision: The Data Pulse
The "Pulse" represents the heartbeat of the platform—a continuous stream of high-fidelity market data that keeps hoteliers ahead of the curve.

## 2. Pipeline Orchestration: The Asynchronous Mesh

The system has evolved from a simple linear scraper into an **Asynchronous Agent Mesh** optimized for scale and data integrity.

### Stage A: The System Heartbeat (`monitor_service.py`)
- **Trigger**: Every 4 hours (SCAN_PULSE_INTERVAL_HOURS) via GitHub Action Cron.
- **Responsibility**:
    1.  **Poll Existing Tasks**: Checks for completed external scans from the previous cycle.
    2.  **Dispatch New Scans**: Identifies properties needing a "Pulse" check and dispatches them in **Batches of 100**.
    3.  **Persistence**: Offloads raw results to the `ScanPersistenceService`.

### Stage B: The Provider Interface (`DataForSEOProvider`)
- **Action**: Converts internal Hotel IDs into optimized search keywords and location tokens.
- **Responsibility**:
    - **Normalization**: Transliterates Turkish characters (ı -> i, ş -> s) to satisfy API constraints.
    - **Async Submission**: Uses `task_post` to submit batch requests without blocking the main event loop.
    - **Tracking**: Maps DataForSEO Task IDs to internal `scan_task` UUIDs.

### Stage C: The Data Quality Firewall (`ScanPersistenceService`)
- **Action**: A multi-tiered validation pipeline that filters noise before it hits the production database.
- **Responsibility**:
    - **Price Floors**: Rejects unrealistic rates (e.g., < 3000 TRY for a Ramada).
    - **Variance Checks**: Flags prices deviating by > 30% from the verified 5-day baseline.
    - **Smart Continuity**: If a scan fails or returns zero, uses the most recent valid historical price to maintain a continuous graph.

## 3. Database Schema: The Storage Backbone

### `scan_batches` & `scan_tasks`
Tracks the lifecycle of asynchronous background work.
- `scan_batches`: High-level container for a pulse check (e.g., "Market Pulse - April 14").
- `scan_tasks`: Individual units of work mapping a specific hotel to an external provider task.

### `price_logs`
The primary source for all time-series intelligence. 
- Optimized with a unique index to prevent duplicate entries from overlapping scans.

### `room_type_catalog`
A semantic index of normalized room offerings (e.g., "Superior Double Sea View"). Each entry includes a **Vector Embedding** for AI-driven comparison.

---
*Document Version 1.2 - April 2026*
