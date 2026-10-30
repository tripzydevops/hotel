# Sentinel: Autonomous Monitoring Protocol [KAIZEN 2026] 🛡️🤖

## 1. Overview
The **Sentinel** is the core autonomous engine of HotelPlus, responsible for high-fidelity price monitoring and parity discovery. It operates as a background mesh that ensures every hotel tracked by users is scanned for pricing updates at regular intervals, regardless of user activity.

## 2. The "Token-First" Mandate [CRITICAL]
To ensure maximum cost-efficiency and data precision, the Sentinel enforces a strict **Token-First** strategy.

### **Requirement**
A hotel is only eligible for an autonomous scan if it possesses at least one of the following:
- `property_token`: A unique identifier provided by the mapping engine.
- `serp_api_id`: A direct Google Hotels / OTA reference ID.

### **Rationale**
- **Avoid Cost Bloat**: Without a token, the system is forced to perform city-wide keyword searches. These are significantly more expensive and often return low-quality or irrelevant results.
- **Precision Guarantee**: Tokens ensure the "Search AI" lands directly on the intended property, eliminating the risk of misattributing prices to nearby competitors.

### **Outcome of Missing Tokens**
Hotels missing these tokens are logged as **"Unmapped"** and are **BYPASSED** during the heartbeat. These properties should be prioritized for the Discovery Engine.

## 3. Governance & Global Visibility
All autonomous scans are designed for system-wide transparency.

- **`user_id: NULL`**: Every heartbeat session and associated scan is recorded with a `null` user ID. 
- **Universal Access**: By using a null owner, the data becomes visible on global admin dashboards and is shared across all users who monitor the same hotel, maximizing the utility of every paid scan.
- **Sentinel Dashboard**: Admins can monitor the heartbeat status, hotel counts, and unmapped warnings via the main Sentinel Panel.

## 4. Operational Cycle (Heartbeat)
The system pulse is dictated by the `SCAN_PULSE_INTERVAL_HOURS` constant (typically **2-4 hours**).

1. **Location Resolution**: Before scanning, the system resolves any human-readable locations into provider-specific `location_codes`.
2. **Pulse Emission**: A `system_pulse` event is recorded in `query_logs` to signal that the monitor is alive.
3. **Scan Batching**: Eligible hotels are batched (100 per batch) and dispatched to the DataForSEO Agent-Mesh.
4. **Result Persistence**: Completed tasks are retrieved and archived into `price_logs` and `hotel_info`.

## 5. Data Integrity Standards
- **Currency Mapping**: The Sentinel respects the `preferred_currency` set in `user_hotels`. If not specified, it falls back to the hotel's default or the global system default.
- **Deduplication**: The heartbeat automatically deduplicates hotels monitored by multiple users to prevent redundant API spend.
- **Deep Scans**: Every 24 hours, the heartbeat triggers a "Deep Scan" to update rich metadata (amenities, reviews, sentiment) in addition to pricing.

## 6. Troubleshooting & Logs
- **`scheduler.log`**: The primary source for heartbeat diagnostics. Look for "Skipping X hotels missing property tokens" to identify unmapped properties.
- **`query_logs`**: Displays real-time heartbeat activity on the user-facing dashboard feeds.
- **`market_heartbeat_logs`**: Detailed performance metrics for every heartbeat session.

---
> [!NOTE]
> This protocol is part of the **Kaizen 2026** initiative to transition HotelPlus from a reactive tool to a proactive autonomous intelligence platform.
