# HotelPlus — Comprehensive Architecture & Developer Guide

> **Purpose**: This document is the single source of truth for the HotelPlus platform. Any AI agent or developer resuming work should read this **first** before touching any code.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Backend Architecture](#5-backend-architecture)
6. [DataForSEO Scan Pipeline](#6-dataforseo-scan-pipeline)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Key Data Flows](#8-key-data-flows)
9. [Known Bugs & Fixes Log](#9-known-bugs--fixes-log)
10. [Environment & Configuration](#10-environment--configuration)
11. [Deployment](#11-deployment)
12. [Common Debugging Patterns](#12-common-debugging-patterns)

---

## 1. System Overview

HotelPlus is a **hotel market intelligence and autonomous rate parity discovery platform**. It monitors hotel prices across OTAs (Online Travel Agencies), detects parity violations, analyzes guest sentiment, and generates strategic narratives.

### Core Capabilities
- **Rate Parity Monitoring**: Compares direct hotel rates against Booking.com, Expedia, TripAdvisor, Trip.com etc.
- **DataForSEO Integration**: Automated scan pipeline for price data and hotel info collection.
- **Sentiment Analysis**: Aggregates and themes guest reviews across platforms.
- **Parity Alerts**: Notifies when OTA rates undercut the hotel's own direct rate.
- **Multi-Hotel Dashboard**: Single view for target hotel + competitors.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend Framework | Next.js | `15.1.11` | **DO NOT UPGRADE** — locked for InsForge middleware stability |
| UI Library | React | `19.0.x` | Stable concurrent features |
| Styling | Tailwind CSS | `3.4.14` | **DO NOT UPGRADE TO v4** — standard directives only |
| Database | PostgreSQL (InsForge) | Latest | PostgREST API access |
| Backend Framework | FastAPI | Latest stable | Python async backend |
| Python Runtime | Python 3.11+ | — | Uses `.venv` — never install global packages |
| OTA Data Provider | DataForSEO API | — | Price search + hotel_info scan types |
| AI/LLM | Google Gemini | — | Narrative generation, sentiment, agents |
| Hosting | Vercel (frontend) | — | Production deployments |
| Backend Hosting | InsForge (BaaS) | — | DB, Auth, Storage, Functions |

---

## 3. Directory Structure

```
hotel/
├── app/                          # Next.js App Router pages
│   ├── (dashboard)/              # Main dashboard views
│   │   ├── page.tsx              # /dashboard — main view
│   │   ├── analytics/            # Trend & analytics pages
│   │   └── parity/               # Parity monitor page
│   ├── api/                      # Next.js API routes (proxies to FastAPI)
│   │   ├── cron/                 # Vercel Cron trigger endpoint
│   │   ├── dashboard/            # Dashboard data endpoint
│   │   └── webhook/              # DataForSEO postback handler
│   └── layout.tsx
├── backend/
│   ├── api/                      # FastAPI route definitions (domain-isolated)
│   │   ├── dashboard.py          # GET /api/dashboard/{user_id}
│   │   ├── hotels.py             # Hotel CRUD
│   │   ├── scans.py              # Scan triggers & status
│   │   └── webhook.py            # POST /api/webhook/dataforseo
│   ├── agents/                   # Specialized LLM agents
│   │   ├── scraping_agent.py     # DataForSEO result parsing
│   │   └── narrative_agent.py    # Synthetic narrative generation
│   ├── services/                 # Pure business logic
│   │   ├── dashboard_service.py  # *** Main dashboard assembly logic ***
│   │   ├── hotel_service.py      # Hotel CRUD + metadata enrichment
│   │   ├── scan_persistence.py   # *** Writes scan results to DB ***
│   │   ├── monitor_service.py    # Scan scheduling & recovery
│   │   ├── analysis_service.py   # Sentiment & parity analysis
│   │   ├── alert_service.py      # Parity alert generation
│   │   └── providers/
│   │       └── dataforseo_provider.py  # *** DataForSEO API integration ***
│   ├── scripts/
│   │   └── continuous_monitor.py # Local dev scan loop (NOT production)
│   └── migrations/               # SQL migration files (numbered)
│       └── insforge_schema_rebuild.sql  # Full schema reference
├── components/
│   ├── modals/
│   │   └── HotelDetailsModal.tsx # *** Hotel detail popup (currency + reviews) ***
│   ├── analytics/                # Recharts chart components
│   └── ui/                       # Shared UI primitives
├── types/
│   └── index.ts                  # TypeScript type definitions
├── lib/
│   ├── utils.ts                  # parsePrice, cn, formatters
│   └── i18n.ts                   # Translation hook
└── public/
```

---

## 4. Database Schema

### Core Tables

#### `hotels`
The master hotel record. Updated on every `hotel_info` scan.
```sql
id                  UUID PRIMARY KEY
name                TEXT
serp_api_id         TEXT UNIQUE        -- DataForSEO hotel token
property_token      TEXT               -- Legacy token field
currency            TEXT               -- *** AUTHORITATIVE currency field ***
rating              NUMERIC
review_count        INTEGER
stars               INTEGER
image_url           TEXT
latitude            NUMERIC
longitude           NUMERIC
address             TEXT
location            TEXT
amenities           JSONB              -- Array of amenity strings
images              JSONB              -- Array of {original, thumbnail} objects
reviews             JSONB              -- Nested object (legacy, see other_sites_reviews)
other_sites_reviews JSONB              -- Array: [{title, url, rating:{value,rating_max,...}, review_text}]
market_offers       JSONB              -- OTA price offers from hotel_info scan
parity_offers       JSONB              -- Subset of market_offers flagged for parity
offers              JSONB              -- Generic offers
room_types          JSONB              -- Array: [{name, price, currency, source}]
sentiment_breakdown JSONB              -- Array of sentiment pillars
guest_mentions      JSONB
deleted_at          TIMESTAMP          -- Soft delete
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**Critical note**: `currency` is the DB-authoritative currency. The frontend must use this as fallback when `price_info.currency` is absent.

#### `user_hotels`
Join table linking users to hotels with preferences.
```sql
id                  UUID PRIMARY KEY
user_id             UUID               -- FK to auth.users
hotel_id            UUID               -- FK to hotels
is_target           BOOLEAN            -- TRUE = the user's own hotel
is_monitored        BOOLEAN
preferred_currency  TEXT               -- User preference OVERRIDE (may differ from hotels.currency)
fixed_check_in      DATE
fixed_check_out     DATE
default_adults      INTEGER DEFAULT 2
pricing_dna         JSONB
```

**Critical note**: `preferred_currency` here is a USER preference, not the hotel's actual currency. The fallback priority chain is:
`price_info.currency > hotels.currency > user_hotels.preferred_currency > "TRY"`

#### `price_logs`
Every price scan result. This is the time-series price table.
```sql
id              UUID PRIMARY KEY
hotel_id        UUID               -- FK to hotels
price           NUMERIC
currency        TEXT
room_types      JSONB
offers          JSONB
parity_offers   JSONB
market_offers   JSONB
ota_prices      JSONB
check_in_date   DATE
recorded_at     TIMESTAMP
scan_session_id UUID               -- FK to scan_sessions
```

#### `scan_sessions`
Groups a batch of scans for a user.
```sql
id                  UUID PRIMARY KEY
user_id             UUID
hotel_id            UUID
status              TEXT    -- 'pending' | 'running' | 'completed' | 'failed'
target_parameters   JSONB   -- {check_in, check_out, adults, hotel_name}
adults              INTEGER
check_out_date      DATE
created_at          TIMESTAMP
completed_at        TIMESTAMP
```

#### `scan_tasks`
Individual DataForSEO API tasks. One session has many tasks.
```sql
id              UUID PRIMARY KEY
session_id      UUID
hotel_id        UUID
task_type       TEXT    -- 'price_search' | 'hotel_info'
status          TEXT    -- 'pending' | 'submitted' | 'completed' | 'failed'
external_id     TEXT    -- DataForSEO task ID
result_data     JSONB   -- Raw API response
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `room_type_catalog`
Canonical room type records per hotel/source.
```sql
id          UUID PRIMARY KEY
hotel_id    UUID
name        TEXT
source      TEXT        -- *** Added in migration 040 ***
url         TEXT        -- *** Added in migration 040 ***
capacity    INTEGER     -- *** Added in migration 040 ***
image_url   TEXT        -- *** Added in migration 040 ***
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

#### `hotel_directory`
Global shared hotel metadata (cross-user enrichment cache).
```sql
id              UUID PRIMARY KEY
serp_api_id     TEXT UNIQUE
name            TEXT
rating          NUMERIC
review_count    INTEGER
sentiment_breakdown JSONB
images          JSONB
...             -- mirrors hotels table for shared enrichment
```

#### `hotel_reviews`
Granular per-review records (separate from the JSONB snapshot in `hotels`).
```sql
id              UUID PRIMARY KEY
hotel_id        UUID
source          TEXT    -- 'tripadvisor' | 'booking' | 'google' | etc.
rating          NUMERIC
review_text     TEXT
review_date     DATE
created_at      TIMESTAMP
```

#### `alerts`
Parity breach and price change alerts.
```sql
id              UUID PRIMARY KEY
user_id         UUID
hotel_id        UUID
message         TEXT
old_price       NUMERIC
new_price       NUMERIC
is_read         BOOLEAN DEFAULT FALSE
is_global_pulse BOOLEAN DEFAULT FALSE  -- TRUE = anonymous Global Pulse win
created_at      TIMESTAMP
```

---

## 5. Backend Architecture

### 3-Layer Architecture

```
HTTP Request
     ↓
[Next.js API Route]  (/app/api/*)
     ↓ (internal fetch, proxied via next.config.ts rewrites)
[FastAPI Router]     (/backend/api/*.py)
     ↓
[Service Layer]      (/backend/services/*.py)
     ↓
[InsForge DB Client] (postgrest-py)
```

### Key Services

#### `dashboard_service.py` — Critical Service
Assembles the entire dashboard payload. Called by `/api/dashboard/{user_id}`.

**Phase 1** (parallel, asyncio.gather):
- Fetches profile, settings, alerts, searches, sessions, active scans, hotels

**Hotel fetch query** (in `_fetch_user_hotels`):
```python
db.table("user_hotels")
  .select("*, hotel:hotels(id, name, currency, room_types, stars, rating, review_count, "
          "image_url, latitude, longitude, amenities, images, reviews, other_sites_reviews, "
          "guest_mentions, sentiment_breakdown, serp_api_id, property_token, deleted_at, address, location, "
          "market_offers, parity_offers, offers)")
  .eq("user_id", uid)
```

**Phase 2** (after hotel IDs known):
- Batch price fetch via RPC `get_batch_hotel_prices`
- Directory enrichment via `hotel_directory`
- Sentiment recovery fallback

**Enrichment loop** (per hotel):
1. Merge `dir_data` (directory) → `h` (user hotel) — user data wins
2. Extract `other_sites_reviews` from `h.other_sites_reviews` OR `reviews.other_sites_reviews`
3. Build `price_info` from `price_logs` or fallback to `hotels` table fields
4. Calculate `parity_score`
5. Calculate `overall_sentiment_score`

#### `scan_persistence.py` — Write Path
Called after DataForSEO tasks complete. Writes to `hotels`, `price_logs`, `scan_tasks`.

Key function: `persist_hotel_info_result()`
- Extracts `other_sites_reviews` from `hotel_info` response
- Saves as JSONB array to `hotels.other_sites_reviews`
- Also saves `market_offers` for OTA comparison

#### `dataforseo_provider.py` — API Integration
Two task types:

| Type | DataForSEO Endpoint | Trigger | Persists To |
|---|---|---|---|
| `price_search` | `/hotels/search/task_post` | Scheduled (hourly) | `price_logs` |
| `hotel_info` | `/hotels/info/task_post` | Scheduled (daily or on-demand) | `hotels.*` |

**Webhook routing**: Results arrive at `/api/webhook/dataforseo`. The webhook handler reads `task_type` from `scan_tasks` and routes to the correct parser.

---

## 6. DataForSEO Scan Pipeline

### Flow Diagram
```
Vercel Cron (/api/cron)  OR  continuous_monitor.py [LOCAL ONLY]
         ↓
  monitor_service.py → creates scan_session + scan_tasks (status='pending')
         ↓
  dataforseo_provider.py → POST to DataForSEO API → returns task ID
         ↓
  scan_tasks.external_id = task_id, status = 'submitted'
         ↓
  [DataForSEO processes async]
         ↓
  POST to /api/webhook/dataforseo  (postback_url)
         ↓
  webhook.py → reads task_type → routes to parser
         ↓
  scan_persistence.py → upsert to hotels + price_logs
```

### Recovery Path
If webhook is not received within timeout:
```
monitor_service.py recovery loop
  → finds scan_tasks with status='submitted' and age > threshold
  → calls dataforseo_provider.get_task_result(external_id)
  → manually routes to persistence
```

### Key Bug History (see §9 for full details)
- Race conditions from multiple `continuous_monitor.py` processes → run ONE process only
- "Shape B" parsing: `hotel_info` responses sometimes lack `items` → guard with `if not items: return`
- Blind webhook routing: must read `task_type` from DB, not guess from payload
- Index misalignment in monitor_service: off-by-one when slicing hotel batches
- `postback_url` rejection: DataForSEO validates the URL — use a publicly accessible URL in prod

---

## 7. Frontend Architecture

### State Management
- **React Query** (`@tanstack/react-query`) — server state, dashboard data fetching
- **Zustand** (if present) — local UI state
- **No Redux** — prefer co-located state

### Key Components

#### `HotelDetailsModal.tsx`
The hotel detail popup. Contains 6 tabs: Overview, Gallery, Amenities, Offers, Rooms, Reviews.

**Currency resolution order** (correct after Bug Fix #7):
```typescript
const displayCurrency = 
  hotel?.price_info?.currency  // From latest price_log
  || hotel?.currency           // DB column on hotels table (authoritative)
  || hotel?.preferred_currency // User preference from user_hotels
  || "TRY";                    // Final default
```

**Reviews tab**: Reads `hotel.other_sites_reviews` (array). Shows empty state if no data collected yet. The backend normalizes the nested `rating: {value, rating_max}` structure at `dashboard_service.py:602-604` and the frontend normalizes it again at lines 77-82 of the modal.

**Review data structure** (from DataForSEO):
```json
{
  "title": "Tripadvisor",
  "url": "https://...",
  "rating": {
    "value": 4.3,
    "rating_max": null,
    "rating_type": "Max5",
    "votes_count": 78
  },
  "review_text": "..."
}
```
`rating_max: null` = Max5 scale. `rating_max: 10` = Booking.com 1-10 scale.

#### `dashboard_service.py` → Frontend type
The `HotelWithPrice` interface (in `types/index.ts`) extends `Hotel`. Key fields used by dashboard:
```typescript
interface Hotel {
  currency: string;          // From hotels.currency DB column
  other_sites_reviews?: ...  // Array of platform reviews
  price_info?: PriceInfo;    // Assembled by dashboard_service
}
interface HotelWithPrice extends Hotel {
  preferred_currency?: string;  // From user_hotels.preferred_currency
  price_info: PriceInfo;
}
```

---

## 8. Key Data Flows

### Flow 1: Dashboard Load
```
User opens /dashboard
  → React Query calls GET /api/dashboard/{user_id}
  → Next.js API Route proxies to FastAPI
  → dashboard_service.get_dashboard_logic() runs
  → Returns {target_hotel, competitors, price_info, other_sites_reviews, ...}
  → Dashboard renders HotelCard components
  → User clicks hotel → HotelDetailsModal opens with hotel data
```

### Flow 2: Scan → DB → Frontend
```
Cron triggers scan
  → scan_session created (status='pending')
  → scan_tasks created per hotel per task_type
  → DataForSEO API called → external_id stored
  → DataForSEO POSTs to webhook
  → scan_persistence writes:
      price_search → price_logs
      hotel_info → hotels (currency, other_sites_reviews, market_offers, room_types)
  → Next dashboard load picks up fresh data
```

### Flow 3: Currency Display
```
price_log.currency (from scan, e.g. "TRY")
  → dashboard_service wraps in price_info.currency
  → HotelDetailsModal reads hotel.price_info.currency
  → Fallback: hotel.currency (hotels table)
  → Fallback: hotel.preferred_currency (user preference)
  → Fallback: "TRY"
```

---

## 9. Known Bugs & Fixes Log

### Bug #1 — Race Condition (Multiple Monitor Processes)
**Date**: 2026-05-04  
**Symptom**: Duplicate scan tasks, API quota exhaustion  
**Root Cause**: Multiple `continuous_monitor.py` processes running simultaneously  
**Fix**: Kill all but one process. Never run more than 1 instance locally.

### Bug #2 — "Shape B" Parsing Error
**Date**: 2026-05-04  
**File**: `backend/services/providers/dataforseo_provider.py`  
**Symptom**: `TypeError` when `hotel_info` response has no `items` key  
**Root Cause**: DataForSEO sometimes returns `{"result": [{"hotel_info": {}}]}` without an `items` array  
**Fix**: Guard `if not items: return None` before iterating

### Bug #3 — Blind Webhook Routing
**Date**: 2026-05-04  
**File**: `backend/api/webhook.py`  
**Symptom**: `price_search` results being parsed as `hotel_info`  
**Root Cause**: Webhook tried to infer task type from payload structure instead of reading from DB  
**Fix**: Look up `scan_tasks.task_type` by `external_id` before routing

### Bug #4 — Index Misalignment in Monitor Service
**Date**: 2026-05-04  
**File**: `backend/services/monitor_service.py`  
**Symptom**: First hotel in batch always skipped  
**Root Cause**: Off-by-one slicing when batching hotel IDs  
**Fix**: Corrected slice indices

### Bug #5 — Postback URL Rejection
**Date**: 2026-05-04  
**Symptom**: DataForSEO returns error: "postback_url is invalid"  
**Root Cause**: Localhost URL used in production; DataForSEO validates URL is publicly reachable  
**Fix**: Use the Vercel deployment URL for `DATAFORSEO_POSTBACK_URL` in prod

### Bug #6 — `room_type_catalog` PGRST204 Column Mismatch
**Date**: 2026-05-04  
**File**: `backend/migrations/insforge_schema_rebuild.sql`, `040_room_catalog_add_columns.sql`  
**Symptom**: `PGRST204` — column `source` (or `url`, `capacity`, `image_url`) of table `room_type_catalog` does not exist  
**Root Cause**: Schema rebuild SQL was missing 4 columns that `scan_persistence.py` was writing to  
**Fix**: Added `source TEXT`, `url TEXT`, `capacity INTEGER`, `image_url TEXT` to both the rebuild SQL and a new migration `040_room_catalog_add_columns.sql`

### Bug #7 — Currency Displays as USD (Wrong Fallback)
**Date**: 2026-05-04  
**File**: `components/modals/HotelDetailsModal.tsx`  
**Symptom**: Prices displayed in USD when hotel's actual currency is TRY  
**Root Cause**: Fallback chain was `price_info.currency || "USD"` — missing `hotel.currency` (DB column)  
**Fix**: Changed fallback to `price_info.currency || hotel.currency || preferred_currency || "TRY"` in 3 places (lines 259, 445, 493)

### Bug #8 — Reviews Tab Appears Empty (Data Not Yet Collected)
**Date**: 2026-05-04  
**Status**: NOT a code bug — data issue  
**Symptom**: Reviews tab shows "No Source Reviews Yet" for most hotels  
**Root Cause**: Only hotels that have completed a `hotel_info` scan will have `other_sites_reviews` populated. Most hotels in the system haven't had a `hotel_info` scan yet.  
**Resolution**: Run `hotel_info` scans for target hotels. The data pipeline is correct; only collection is pending.  
**Verification**: `SELECT id, name, jsonb_array_length(other_sites_reviews) FROM hotels WHERE other_sites_reviews IS NOT NULL;`

---

## 10. Environment & Configuration

### Required Environment Variables

| Variable | Where Used | Notes |
|---|---|---|
| `DATAFORSEO_LOGIN` | `dataforseo_provider.py` | DataForSEO account email |
| `DATAFORSEO_PASSWORD` | `dataforseo_provider.py` | DataForSEO account password |
| `DATAFORSEO_POSTBACK_URL` | Scan task creation | Must be publicly accessible URL ending in `/api/webhook/dataforseo` |
| `INSFORGE_URL` | DB client | Backend base URL |
| `INSFORGE_KEY` | DB client | Service role key (backend only) |
| `NEXT_PUBLIC_INSFORGE_URL` | Frontend SDK | Same URL, exposed to browser |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Frontend SDK | Anonymous key for client auth |
| `GOOGLE_API_KEY` | Gemini agent | For narrative generation |

### Currency Configuration
- **Hotel-level**: `hotels.currency` column (set during scan, e.g. `"TRY"`)
- **User-level**: `user_hotels.preferred_currency` (user override)
- **Display-level**: `user_settings.currency` (dashboard-wide display currency, used for conversion)
- **Conversion**: `dashboard_service.convert_currency()` converts all prices to `display_currency`

### DataForSEO Task Types
- `price_search`: Cheaper, returns current prices. Triggered hourly. Does NOT return OTA breakdown.
- `hotel_info`: More expensive, returns full OTA breakdown + reviews + room types. Triggered daily/on-demand.

---

## 11. Deployment

### Production
- **Frontend**: Vercel (auto-deploy on push to `main`)
- **Backend**: InsForge edge functions / FastAPI (deployed separately)
- **Cron**: Vercel Cron triggers `/api/cron` endpoint
- **Webhook**: DataForSEO POSTs to `https://<vercel-domain>/api/webhook/dataforseo`

### Local Development
```bash
# Frontend
npm run dev

# Backend (SINGLE PROCESS ONLY)
cd backend
source .venv/bin/activate
python scripts/continuous_monitor.py

# NEVER run multiple monitor processes simultaneously
```

### Database Migrations
Migration files in `backend/migrations/`. Apply sequentially:
```sql
-- Example: applying migration 040
-- Run via InsForge run-raw-sql MCP tool or psql
```
The `insforge_schema_rebuild.sql` is the canonical full schema for fresh rebuilds.

---

## 12. Common Debugging Patterns

### "Dashboard shows old data / no price"
1. Check `price_logs` has recent entries for the hotel: `SELECT * FROM price_logs WHERE hotel_id = '...' ORDER BY recorded_at DESC LIMIT 5;`
2. Check scan_tasks status: `SELECT status, task_type, updated_at FROM scan_tasks WHERE hotel_id = '...' ORDER BY updated_at DESC LIMIT 10;`
3. Check if scan_session is stuck: `SELECT * FROM scan_sessions WHERE status IN ('pending', 'running') ORDER BY created_at DESC;`

### "Reviews tab is empty"
1. Check if `other_sites_reviews` is populated: `SELECT name, jsonb_array_length(other_sites_reviews) FROM hotels WHERE id = '...';`
2. If 0 or null → trigger a `hotel_info` scan for this hotel
3. If populated → check frontend console for JS errors in the modal

### "Currency shows wrong"
1. Verify `hotels.currency` column is set: `SELECT id, name, currency FROM hotels WHERE id = '...';`
2. If null → `hotel_info` scan hasn't run yet or provider didn't parse currency
3. If set → check `dashboard_service.py` enrichment loop isn't overwriting with wrong value

### "Parity score is always 100%"
1. Check if `price_info.offers` array is non-empty for the hotel
2. Check if `room_type_standard` is set to a standard-type key (not "Suite")
3. Verify OTA prices are being converted to the same `display_currency`

### "PGRST204 error on scan"
1. Column exists in `scan_persistence.py` INSERT but not in DB schema
2. Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'room_type_catalog';`
3. Add missing column via migration and update `insforge_schema_rebuild.sql`

### "DataForSEO webhook not firing"
1. Verify `DATAFORSEO_POSTBACK_URL` is a public URL (not localhost)
2. Check DataForSEO task status directly: `GET /v3/hotels/info/task_get/{task_id}`
3. Use recovery loop: scan_tasks with `status='submitted'` and `updated_at` older than 10 min

---

*Last Updated: 2026-05-04 | Maintained by: AI Agent / DevOps Team*
