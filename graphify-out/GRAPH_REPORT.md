# Graph Report - hotel  (2026-05-04)

## Corpus Check
- 457 files · ~258,965 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1843 nodes · 3743 edges · 59 communities detected
- Extraction: 45% EXTRACTED · 55% INFERRED · 0% AMBIGUOUS · INFERRED: 2053 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 233|Community 233]]
- [[_COMMUNITY_Community 234|Community 234]]
- [[_COMMUNITY_Community 235|Community 235]]
- [[_COMMUNITY_Community 236|Community 236]]
- [[_COMMUNITY_Community 237|Community 237]]
- [[_COMMUNITY_Community 238|Community 238]]
- [[_COMMUNITY_Community 239|Community 239]]
- [[_COMMUNITY_Community 240|Community 240]]
- [[_COMMUNITY_Community 241|Community 241]]
- [[_COMMUNITY_Community 243|Community 243]]
- [[_COMMUNITY_Community 244|Community 244]]
- [[_COMMUNITY_Community 245|Community 245]]
- [[_COMMUNITY_Community 249|Community 249]]

## God Nodes (most connected - your core abstractions)
1. `ProviderFactory` - 96 edges
2. `ApiClient` - 84 edges
3. `AdminStats` - 83 edges
4. `AdminUser` - 83 edges
5. `AdminDirectoryEntry` - 83 edges
6. `AdminLog` - 83 edges
7. `SystemLogEntry` - 83 edges
8. `SystemLogsResponse` - 83 edges
9. `HealthMetrics` - 83 edges
10. `AdminUserCreate` - 82 edges

## Surprising Connections (you probably didn't know these)
- `test_ids()` --calls--> `DataForSEOProvider`  [INFERRED]
  test_ids.py → backend/services/providers/dataforseo_provider.py
- `test_merge()` --calls--> `ScanPersistenceService`  [INFERRED]
  test_batch_sync.py → backend/services/scan_persistence.py
- `test_query()` --calls--> `get_insforge_db()`  [INFERRED]
  scratch_test_query.py → backend/utils/db.py
- `test_historical_data()` --calls--> `get_market_intelligence_data()`  [INFERRED]
  reproduce_calendar_bug.py → backend/services/analysis_service.py
- `find()` --calls--> `get_supabase()`  [INFERRED]
  find_hotel_ids.py → backend/scripts/heal_embeddings.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (176): AnalystAgent, Phase 1: Persists raw scraper data and performs basic heuristic analysis (ARI, b, Phase 2: Deep AI Reasoning (Market Intelligence).         This is slower and use, Analyst Agent.     Specialized in price analytics, trend detection, and multi-ho, Background task to update a user's pricing DNA for a specific property., Legacy wrapper for backward compatibility., Helper to extract pulse data and dispatch background alerts., VECTOR SEARCH Logic for ghost competitor discovery with geographical filtering. (+168 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (69): ABC, Agent responsible for data acquisition from SerpApi., Performs the actual scraping for a list of hotels., Buffer a log entry in memory for batch processing later., Batch update the reasoning trace to the database in a single round-trip., Cross-User Shared Cache         Searches price_logs for ANY hotel that shares th, ScraperAgent, test_ids() (+61 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (68): test_historical_data(), test_query(), test_merge(), main(), main(), check_hotels(), main(), main() (+60 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (70): get_network_stats(), [Global Pulse Phase 2] — Pulse Routes API endpoints for the Global Pulse network, Returns live Global Pulse network metrics.     Used by GlobalPulseFeed.tsx to di, External cron entry point., trigger_cron_job(), find(), audit(), check() (+62 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (92): execute_strategy_bridge(), ExecutionRequest, [Future-Proofing] Webhook listener for AI-recommended actions.     Prepares for, list_locations(), Creates a hotel with plan-based limits, profile self-healing, and     token disc, Search hotel directory (local + live callback). No auth required., Retrieves a list of hotels associated with the current user., Fetch all discovered locations for the dropdowns. (+84 more)

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (103): get_admin_heartbeats(), get_admin_users(), Fetches high-level system statistics for the Admin Dashboard.     Includes total, Directly updates a user profile from the admin interface.     Used for managing, Lists all users in the system with their roles and subscription status.     Prov, Retrieves the global hotel directory.     This is the source of truth for "Disco, Administrative user creation. Used for internal team onboarding., Deletes a user and their associated data (hotels, scans, logs).     Used for com (+95 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (5): fetchBrief(), handleSaveSettings(), ApiClient, fetchPulse(), fetchStats()

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (74): add_admin_directory_entry(), admin_update_user(), cleanup_empty_scans(), cleanup_test_data(), create_admin_plan(), create_admin_user(), debug_providers(), delete_admin_directory() (+66 more)

### Community 8 - "Community 8"
Cohesion: 0.03
Nodes (53): get_dashboard(), get_global_pulse(), Main dashboard data aggregator., Fetches recent price drops discovered by the Global Pulse network.     Anonymize, normalize_sentiment(), Standardize DataForSEO reviews_breakdown to internal schema., test_mapping(), run_audit() (+45 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (25): DataForSEOClient, DataForSEO Client for Hotel Metadata Enrichment Fetches detailed hotel informati, Map DataForSEO result fields to internal format., Client for interacting with DataForSEO API to get rich hotel metadata., Generate Basic Auth header., Fetch hotel details using Google Maps Business Data API., NotificationService, Notification Service Handles sending email notifications for alerts. (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (33): create_hotel(), delete_hotel(), list_hotels(), search_hotel_directory(), search_hotel_directory_v2(), update_hotel(), backfill_search_names(), add_hotel_to_account_logic() (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (22): handleDestroyKey(), handleReload(), handleReset(), handleRotate(), loadKeyStatus(), handleDelete(), handleSave(), loadPlans() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (28): auth_root_sync(), auth_token_bridge(), get_current_session(), get_current_session_v1(), get_user_info(), get_user_info_v1(), Returns current user info., Unified endpoint for base /api/auth calls (SDK compatibility). (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (6): formatCurrency(), parsePrice(), getCurrencySymbol(), handleExport(), ParityHealthSection(), HotelTile()

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (10): global_exception_handler(), Hotel Rate Monitor - FastAPI Backend Main entry point using modular routers. Red, Global exception handler for all unhandled errors.     Ensures internal tracing, Deep diagnostics for environment and database connectivity., Startup health check., startup_event(), system_report(), Service for managing data retention and historical rollups.     Optimized for na (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (7): MarketIntelligenceService, MockTypes, Generates a city-level market briefing in Markdown format., Generates a vector embedding for the given text., Market Intelligence Service.     Uses Gemini to synthesize market data into acti, Summarizes market data into high-level insights using Gemini., TestAIResilience

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (5): AdvisorQuadrant(), SentimentBattlefield(), MarketInsight(), useI18n(), TargetHotelTile()

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (4): useDashboard(), useProfile(), useSettings(), useToast()

### Community 18 - "Community 18"
Cohesion: 0.31
Nodes (8): get_auth_header(), main(), main_async(), process_concurrent_batch(), Enrich Hotel Directory with GPS Coordinates ====================================, Process a batch of hotels concurrently (max 5 concurrent requests)., Search Google Maps for a single hotel and return coordinates., search_hotel_maps()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (5): PredictiveService, Predictive Yield Service Calculates market volatility and suggests dynamic alert, EXPLANATION: Volatility-Aware Intelligence (Kaizen 2026)     The predictive serv, Calculate volatility (Standard Deviation of daily price changes) for a hotel., Apply volatility-aware adjustment to the base threshold.          Formula:

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (3): AnimatedCounter(), RevealSection(), useScrollReveal()

### Community 23 - "Community 23"
Cohesion: 0.6
Nodes (5): main(), process_hotel_results(), Bulk Hotel Scanner using SerpApi Scrapes hotels from Google Hotels via SerpApi f, scan_city_by_stars(), scan_custom_query()

### Community 24 - "Community 24"
Cohesion: 0.47
Nodes (5): enrich_coords(), fetch_results(), Submits a batch of 100 tasks to DataForSEO., Wait and fetch results for a specific task_id., submit_batch()

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (3): main(), MockDB, Table

### Community 27 - "Community 27"
Cohesion: 0.7
Nodes (4): extract_from_booking_url(), extract_from_expedia_url(), extract_from_tripadvisor_url(), extract_hotel_data()

### Community 31 - "Community 31"
Cohesion: 0.6
Nodes (4): main(), process_results(), Brand Scan Script Scans for specific major hotel chains in Turkey to ensure high, scan_brand()

### Community 32 - "Community 32"
Cohesion: 0.8
Nodes (4): clean_name(), load_hotels(), load_locations(), main()

### Community 34 - "Community 34"
Cohesion: 0.4
Nodes (2): LandingGroupLayout(), useTheme()

### Community 35 - "Community 35"
Cohesion: 0.83
Nodes (3): check_tailwind_version(), main(), scan_file_for_violations()

### Community 42 - "Community 42"
Cohesion: 0.83
Nodes (3): format_sql_value(), get_clean_target_cols(), migrate_table()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): format_sentiment_profile(), Constructs a text representation of the hotel's sentiment profile., update_sentiment_embeddings()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): enrich_locations(), live_location_search(), Fallback to live DataForSEO API if local lookup fails.

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (3): post_hotel_tasks(), # IMPORTANT: Update this with your actual Vercel deployment domain, Submits a batch of hotel info tasks to DataForSEO.     Includes the pingback_url

### Community 46 - "Community 46"
Cohesion: 0.83
Nodes (3): check_hotel_limit(), get_all_tiers(), get_user_limits()

### Community 48 - "Community 48"
Cohesion: 0.5
Nodes (2): useAuth(), DebugDataPage()

### Community 49 - "Community 49"
Cohesion: 0.5
Nodes (2): useMarketForecast(), MarketIntelligencePage()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (2): RevealSection(), useScrollReveal()

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (2): Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L, # IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (2): canonicalize_hotels(), 1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (2): main(), test_scrape()

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (1): Diagnostic script: Tests the exact DataForSEO task_post call  that submit_hotel_

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (1): Diagnostic script: probe DataForSEO API directly with a recent task ID to unders

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (1): Import Discovered Hotels Script Indexes hotels from SerpApi search results into

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (2): Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic, run_dataforseo_flow()

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 233 - "Community 233"
Cohesion: 1.0
Nodes (1): Runs the maintenance cycle using a native database function for efficiency.

### Community 234 - "Community 234"
Cohesion: 1.0
Nodes (1): Fetch price and metadata for a specific hotel.

### Community 235 - "Community 235"
Cohesion: 1.0
Nodes (1): Search for hotels based on a query string.

### Community 236 - "Community 236"
Cohesion: 1.0
Nodes (1): Fetch detailed information for a specific hotel.

### Community 237 - "Community 237"
Cohesion: 1.0
Nodes (1): Return the unique name of this provider

### Community 238 - "Community 238"
Cohesion: 1.0
Nodes (1): Retrieve results for a previously submitted task.

### Community 239 - "Community 239"
Cohesion: 1.0
Nodes (1): Check if the provider is healthy (credentials valid, API reachable).

### Community 240 - "Community 240"
Cohesion: 1.0
Nodes (1): Returns the cached mappings, refreshing if expired.

### Community 241 - "Community 241"
Cohesion: 1.0
Nodes (1): Fetches fresh config from Supabase.

### Community 243 - "Community 243"
Cohesion: 1.0
Nodes (1): Fetch all tiers from DB with local caching.

### Community 244 - "Community 244"
Cohesion: 1.0
Nodes (1): Return the limits for a specific user profile.

### Community 245 - "Community 245"
Cohesion: 1.0
Nodes (1): Check if user can add more hotels based on dynamic plan limits.

### Community 249 - "Community 249"
Cohesion: 1.0
Nodes (1): Normalizes a vendor name by removing clutter and mapping to canonical forms.

## Knowledge Gaps
- **178 isolated node(s):** `DataForSEO Pingback handler.     When a task is ready, DataForSEO sends a POST w`, `Returns current user info.`, `Unified endpoint for base /api/auth calls (SDK compatibility).`, `Internal SDK endpoint for session synchronization.`, `SDK Token Refresh bridge.` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 34`** (5 nodes): `layout.tsx`, `LandingGroupLayout()`, `ThemeProvider()`, `theme.tsx`, `useTheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `page.tsx`, `useAuth.ts`, `useAuth()`, `DebugDataPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (4 nodes): `page.tsx`, `useMarketForecast.ts`, `useMarketForecast()`, `MarketIntelligencePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (4 nodes): `page.tsx`, `handleSubmit()`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `cleanup_hotels.py`, `Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L`, `# IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `canonicalize_db.py`, `canonicalize_hotels()`, `1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `test_firecrawl.py`, `main()`, `test_scrape()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `test_dfs_submit.py`, `Diagnostic script: Tests the exact DataForSEO task_post call  that submit_hotel_`, `test_submit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (3 nodes): `diagnose_scan_failure.py`, `main()`, `Diagnostic script: probe DataForSEO API directly with a recent task ID to unders`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (3 nodes): `import_discovered.py`, `import_hotels()`, `Import Discovered Hotels Script Indexes hotels from SerpApi search results into`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (3 nodes): `dfseo_2step_test.py`, `Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic`, `run_dataforseo_flow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (3 nodes): `page.tsx`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (3 nodes): `RevealSection()`, `useScrollReveal()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 233`** (1 nodes): `Runs the maintenance cycle using a native database function for efficiency.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 234`** (1 nodes): `Fetch price and metadata for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 235`** (1 nodes): `Search for hotels based on a query string.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 236`** (1 nodes): `Fetch detailed information for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 237`** (1 nodes): `Return the unique name of this provider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 238`** (1 nodes): `Retrieve results for a previously submitted task.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 239`** (1 nodes): `Check if the provider is healthy (credentials valid, API reachable).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 240`** (1 nodes): `Returns the cached mappings, refreshing if expired.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 241`** (1 nodes): `Fetches fresh config from Supabase.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 243`** (1 nodes): `Fetch all tiers from DB with local caching.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 244`** (1 nodes): `Return the limits for a specific user profile.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 245`** (1 nodes): `Check if user can add more hotels based on dynamic plan limits.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 249`** (1 nodes): `Normalizes a vendor name by removing clutter and mapping to canonical forms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Alert` connect `Community 11` to `Community 4`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `get_insforge_db()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 12`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `get_supabase()` connect `Community 3` to `Community 8`, `Community 0`, `Community 2`, `Community 10`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 137 inferred relationships involving `str` (e.g. with `global_exception_handler()` and `system_report()`) actually correct?**
  _`str` has 137 INFERRED edges - model-reasoned connections that need verification._
- **Are the 95 inferred relationships involving `ProviderFactory` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`ProviderFactory` has 95 INFERRED edges - model-reasoned connections that need verification._
- **Are the 81 inferred relationships involving `AdminStats` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminStats` has 81 INFERRED edges - model-reasoned connections that need verification._
- **Are the 81 inferred relationships involving `AdminUser` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminUser` has 81 INFERRED edges - model-reasoned connections that need verification._