# Pull Request Triage Report (October 2026)

This document records the architectural triage for the 3 legacy open PR branches created in April/May 2026 against `main`.

## Summary Matrix

| Remote Branch | Original Goal | Status in Current `main` | Recommendation |
| :--- | :--- | :--- | :--- |
| `origin/jules-fix-dashboard-regression-6334073610617596545` | Fix dashboard shift & `+-` artifacts | **Superseded**. Dashboard was modularized into `TargetHotelTile.tsx` & `CompetitorTile.tsx`. Negative rate signs and price parsing are handled with `parsePrice` and `Math.abs` in components. | **Close as Superseded** |
| `origin/fix-dashboard-missing-room-types-and-vendors-9879311869994649185` | Fix missing room types & unknown vendors | **Superseded**. `HotelDetailsModal` was refactored into modular `TabRooms.tsx` with deduplication, string/object fallback, and `extract_vendor_name` in `dashboard_service.py`. | **Close as Superseded** |
| `origin/analysis-background-scan-4141033674993951102` | Background scan discrepancy report | **Informational only**. Discrepancies noted in the report were addressed during the scheduler and scan persistence overhauls. | **Close as Superseded** |

### Verification Evidence
- `TabRooms.tsx` includes complete fallback chains for `raw_rooms = (hotel?.price_info?.room_types?.length ? hotel.price_info.room_types : null) || (hotel?.room_types?.length ? hotel.room_types : null) || []`.
- `dashboard_service.py` sweeps `["offers", "ota_prices", "parity_offers", "market_offers"]` using `extract_vendor_name()`.
- Pytest suite (56 tests) and Next.js production build pass cleanly on `main`.
