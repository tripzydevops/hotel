# Graph Report - hotel  (2026-05-09)

## Corpus Check
- 444 files · ~281,959 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1971 nodes · 4367 edges · 76 communities detected
- Extraction: 41% EXTRACTED · 59% INFERRED · 0% AMBIGUOUS · INFERRED: 2592 edges (avg confidence: 0.57)
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 242|Community 242]]
- [[_COMMUNITY_Community 243|Community 243]]
- [[_COMMUNITY_Community 244|Community 244]]
- [[_COMMUNITY_Community 245|Community 245]]
- [[_COMMUNITY_Community 246|Community 246]]
- [[_COMMUNITY_Community 247|Community 247]]
- [[_COMMUNITY_Community 248|Community 248]]
- [[_COMMUNITY_Community 249|Community 249]]
- [[_COMMUNITY_Community 250|Community 250]]
- [[_COMMUNITY_Community 252|Community 252]]
- [[_COMMUNITY_Community 253|Community 253]]
- [[_COMMUNITY_Community 254|Community 254]]
- [[_COMMUNITY_Community 258|Community 258]]
- [[_COMMUNITY_Community 268|Community 268]]
- [[_COMMUNITY_Community 269|Community 269]]
- [[_COMMUNITY_Community 270|Community 270]]
- [[_COMMUNITY_Community 271|Community 271]]
- [[_COMMUNITY_Community 272|Community 272]]
- [[_COMMUNITY_Community 273|Community 273]]
- [[_COMMUNITY_Community 274|Community 274]]
- [[_COMMUNITY_Community 275|Community 275]]
- [[_COMMUNITY_Community 276|Community 276]]
- [[_COMMUNITY_Community 277|Community 277]]
- [[_COMMUNITY_Community 278|Community 278]]
- [[_COMMUNITY_Community 279|Community 279]]
- [[_COMMUNITY_Community 280|Community 280]]
- [[_COMMUNITY_Community 281|Community 281]]
- [[_COMMUNITY_Community 282|Community 282]]
- [[_COMMUNITY_Community 283|Community 283]]
- [[_COMMUNITY_Community 284|Community 284]]

## God Nodes (most connected - your core abstractions)
1. `ProviderFactory` - 124 edges
2. `AdminLog` - 114 edges
3. `AdminStats` - 112 edges
4. `AdminDirectoryEntry` - 112 edges
5. `SystemLogEntry` - 112 edges
6. `SystemLogsResponse` - 112 edges
7. `HealthMetrics` - 112 edges
8. `AdminUser` - 108 edges
9. `AdminUserCreate` - 106 edges
10. `AdminUserUpdate` - 106 edges

## Surprising Connections (you probably didn't know these)
- `test_ids()` --calls--> `DataForSEOProvider`  [INFERRED]
  test_ids.py → backend/services/providers/dataforseo_provider.py
- `test_merge()` --calls--> `ScanPersistenceService`  [INFERRED]
  test_batch_sync.py → backend/services/scan_persistence.py
- `test_admin()` --calls--> `get_insforge_db()`  [INFERRED]
  test_admin.py → backend/utils/db.py
- `test_heartbeat()` --calls--> `get_admin_market_heartbeats_logic()`  [INFERRED]
  test_heartbeat.py → backend/services/admin/system_stats.py
- `find()` --calls--> `get_supabase()`  [INFERRED]
  find_hotel_ids.py → backend/scripts/heal_embeddings.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (168): AnalystAgent, Phase 1: Persists raw scraper data and performs basic heuristic analysis (ARI, b, Phase 2: Deep AI Reasoning (Market Intelligence).         This is slower and use, Analyst Agent.     Specialized in price analytics, trend detection, and multi-ho, Background task to update a user's pricing DNA for a specific property., Legacy wrapper for backward compatibility., Helper to extract pulse data and dispatch background alerts., VECTOR SEARCH Logic for ghost competitor discovery with geographical filtering. (+160 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (223): add_admin_directory_entry_logic(), delete_admin_directory_logic(), delete_admin_hotel_logic(), get_admin_directory_logic(), get_admin_hotels_logic(), Admin — Hotel & Directory Management ====================================== Hand, List all registered properties with detailed user ownership info., Update hotel details via Admin API. (+215 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (136): get_admin_market_heartbeats_logic(), get_system_logs_logic(), Admin — System Statistics & Health Metrics =====================================, Fetch status of registered network providers.      EXPLANATION: Admin Providers, Efficiently tail the scheduler.log file to get the last N lines.     Uses collec, Retrieves real-time system health metrics using market_heartbeat_logs     and sc, Get system-wide statistics., Fetch status of the pulse queue.     Shows users and their proximity to the next (+128 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (84): ABC, test_ids(), HotelDataProvider, DataForSEOProvider, POSTs property tokens to DataForSEO Google Hotels endpoint.         Returns ONLY, POSTs property tokens to DataForSEO Google Hotels endpoint.         Returns ONLY, Submits a batch of hotels for discovery.         Returns the number of tasks suc, Submits a batch of hotels for discovery.         Returns the number of tasks suc (+76 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (87): Runs the Gemini 3 agentic reasoning flow over current scan results.         Dele, High-level orchestration for batch market analysis.         Generates analysis a, Uses Gemini 3 to generate a sharp, executive-level pulse card rationale., get_dashboard(), get_global_pulse(), Main dashboard data aggregator., Fetches recent price drops discovered by the Global Pulse network.     Anonymize, api_generate_dispute() (+79 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (58): test_merge(), test_heartbeat(), main(), main(), inspect_database(), main(), check_scans(), main() (+50 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (5): fetchBrief(), handleSaveSettings(), ApiClient, fetchPulse(), fetchStats()

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (69): execute_strategy_bridge(), ExecutionRequest, [Future-Proofing] Webhook listener for AI-recommended actions.     Prepares for, Creates a hotel with plan-based limits, profile self-healing, and     token disc, Search hotel directory (local + live callback). No auth required., Retrieves a list of hotels associated with the current user., Fetch all discovered locations for the dropdowns., Searches the global hotel directory for a specific name or city.     Used for on (+61 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (25): DataForSEOClient, DataForSEO Client for Hotel Metadata Enrichment Fetches detailed hotel informati, Map DataForSEO result fields to internal format., Client for interacting with DataForSEO API to get rich hotel metadata., Generate Basic Auth header., Fetch hotel details using Google Maps Business Data API., NotificationService, Notification Service Handles sending email notifications for alerts. (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (26): get_market_intelligence_brief(), AGENT_FEATURE: Market Intelligence AI Brief.     Synthesizes market data into ac, BriefingRequest, CreatePDF(), export_briefing_pdf(), export_report_pdf(), export_saved_briefing_pdf(), generate_briefing() (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (28): auth_root_sync(), auth_token_bridge(), get_current_session(), get_current_session_v1(), get_user_info(), get_user_info_v1(), Returns current user info., Unified endpoint for base /api/auth calls (SDK compatibility). (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (10): formatCurrency(), normalizeVendor(), parsePrice(), getRoomCategory(), isStandardRoom(), resolveOtaName(), getCurrencySymbol(), handleExport() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (15): handleDestroyKey(), handleReload(), handleReset(), handleRotate(), loadKeyStatus(), handleDelete(), handleSave(), loadPlans() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (14): global_exception_handler(), Hotel Rate Monitor - FastAPI Backend Main entry point using modular routers. Red, Global exception handler for all unhandled errors.     Ensures internal tracing, Global exception handler for all unhandled errors.     Ensures internal tracing, Deep diagnostics for environment and database connectivity., Deep diagnostics for environment and database connectivity., Startup health check., Startup health check. (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (5): AdvisorQuadrant(), SentimentBattlefield(), MarketInsight(), useI18n(), TargetHotelTile()

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (3): handleSetTarget(), handleSetTarget(), loadData()

### Community 16 - "Community 16"
Cohesion: 0.2
Nodes (7): get_network_stats(), [Global Pulse Phase 2] — Pulse Routes API endpoints for the Global Pulse network, Returns live Global Pulse network metrics.     Used by GlobalPulseFeed.tsx to di, test_stats(), get_pulse_network_stats(), [Global Pulse Phase 2] — Pulse Service Provides network-wide intelligence stats, Returns live network metrics for the Global Pulse dashboard widget.     Cached f

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (9): get_alert_summary_logic(), get_competitor_matrix_logic(), get_market_overview_logic(), get_price_trends_logic(), Admin — Market Intelligence Aggregator ========================================, Return price trend data points for charting.     Optionally scoped to a single h, Build a competitor pricing matrix for a specific hotel.     Shows latest prices, Summarize parity alerts generated in the given window. (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (4): useDashboard(), useProfile(), useSettings(), useToast()

### Community 19 - "Community 19"
Cohesion: 0.31
Nodes (8): get_auth_header(), main(), main_async(), process_concurrent_batch(), Enrich Hotel Directory with GPS Coordinates ====================================, Process a batch of hotels concurrently (max 5 concurrent requests)., Search Google Maps for a single hotel and return coordinates., search_hotel_maps()

### Community 20 - "Community 20"
Cohesion: 0.31
Nodes (8): extract_from_booking_url(), extract_from_expedia_url(), extract_from_tripadvisor_url(), extract_hotel_data_from_url(), Extracts the location ID (g-code) and hotel ID (d-code) from a Tripadvisor URL., Extracts the hotel ID (h-code) from an Expedia or Hotels.com URL.     Returns:, Determines the OTA vendor from the URL and extracts identifying hotel data., Extracts the hotel slug from a Booking.com URL.     Returns:         dict with '

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (5): PredictiveService, Predictive Yield Service Calculates market volatility and suggests dynamic alert, EXPLANATION: Volatility-Aware Intelligence (Kaizen 2026)     The predictive serv, Calculate volatility (Standard Deviation of daily price changes) for a hotel., Apply volatility-aware adjustment to the base threshold.          Formula:

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (3): AnimatedCounter(), RevealSection(), useScrollReveal()

### Community 25 - "Community 25"
Cohesion: 0.6
Nodes (5): main(), process_hotel_results(), Bulk Hotel Scanner using SerpApi Scrapes hotels from Google Hotels via SerpApi f, scan_city_by_stars(), scan_custom_query()

### Community 26 - "Community 26"
Cohesion: 0.47
Nodes (5): enrich_coords(), fetch_results(), Submits a batch of 100 tasks to DataForSEO., Wait and fetch results for a specific task_id., submit_batch()

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (3): main(), MockDB, Table

### Community 29 - "Community 29"
Cohesion: 0.7
Nodes (4): extract_from_booking_url(), extract_from_expedia_url(), extract_from_tripadvisor_url(), extract_hotel_data()

### Community 33 - "Community 33"
Cohesion: 0.6
Nodes (4): main(), process_results(), Brand Scan Script Scans for specific major hotel chains in Turkey to ensure high, scan_brand()

### Community 34 - "Community 34"
Cohesion: 0.8
Nodes (4): clean_name(), load_hotels(), load_locations(), main()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (2): LandingGroupLayout(), useTheme()

### Community 36 - "Community 36"
Cohesion: 0.83
Nodes (3): check_tailwind_version(), main(), scan_file_for_violations()

### Community 43 - "Community 43"
Cohesion: 0.5
Nodes (2): useMarketForecast(), MarketIntelligencePage()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): format_sentiment_profile(), Constructs a text representation of the hotel's sentiment profile., update_sentiment_embeddings()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): enrich_locations(), live_location_search(), Fallback to live DataForSEO API if local lookup fails.

### Community 46 - "Community 46"
Cohesion: 0.83
Nodes (3): check_hotel_limit(), get_all_tiers(), get_user_limits()

### Community 47 - "Community 47"
Cohesion: 0.5
Nodes (2): useAuth(), DebugDataPage()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (2): RevealSection(), useScrollReveal()

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (2): Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L, # IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (2): canonicalize_hotels(), 1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): main(), test_scrape()

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (1): Diagnostic script: Tests the exact DataForSEO task_post call  that submit_hotel_

### Community 68 - "Community 68"
Cohesion: 0.67
Nodes (1): Diagnostic script: probe DataForSEO API directly with a recent task ID to unders

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (1): Import Discovered Hotels Script Indexes hotels from SerpApi search results into

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 153 - "Community 153"
Cohesion: 1.0
Nodes (1): Admin Services Package ====================== Re-exports all admin service funct

### Community 242 - "Community 242"
Cohesion: 1.0
Nodes (1): Runs the maintenance cycle using a native database function for efficiency.

### Community 243 - "Community 243"
Cohesion: 1.0
Nodes (1): Fetch price and metadata for a specific hotel.

### Community 244 - "Community 244"
Cohesion: 1.0
Nodes (1): Search for hotels based on a query string.

### Community 245 - "Community 245"
Cohesion: 1.0
Nodes (1): Fetch detailed information for a specific hotel.

### Community 246 - "Community 246"
Cohesion: 1.0
Nodes (1): Return the unique name of this provider

### Community 247 - "Community 247"
Cohesion: 1.0
Nodes (1): Retrieve results for a previously submitted task.

### Community 248 - "Community 248"
Cohesion: 1.0
Nodes (1): Check if the provider is healthy (credentials valid, API reachable).

### Community 249 - "Community 249"
Cohesion: 1.0
Nodes (1): Returns the cached mappings, refreshing if expired.

### Community 250 - "Community 250"
Cohesion: 1.0
Nodes (1): Fetches fresh config from Supabase.

### Community 252 - "Community 252"
Cohesion: 1.0
Nodes (1): Fetch all tiers from DB with local caching.

### Community 253 - "Community 253"
Cohesion: 1.0
Nodes (1): Return the limits for a specific user profile.

### Community 254 - "Community 254"
Cohesion: 1.0
Nodes (1): Check if user can add more hotels based on dynamic plan limits.

### Community 258 - "Community 258"
Cohesion: 1.0
Nodes (1): Normalizes a vendor name by removing clutter and mapping to canonical forms.

### Community 268 - "Community 268"
Cohesion: 1.0
Nodes (1): Main logic for assembling the dashboard data.     Performes security checks, fet

### Community 269 - "Community 269"
Cohesion: 1.0
Nodes (1): Fetches anonymized recent price drops discovered by the Global Pulse network.

### Community 270 - "Community 270"
Cohesion: 1.0
Nodes (1): Extracts the Bearer token from the Authorization header or query parameter.

### Community 271 - "Community 271"
Cohesion: 1.0
Nodes (1): Verify that the request is made by an Admin.

### Community 272 - "Community 272"
Cohesion: 1.0
Nodes (1): Verify that the user is logged in AND has an active approval status.

### Community 273 - "Community 273"
Cohesion: 1.0
Nodes (1): Dependency that returns an InsForge client with RLS enabled.     Uses the JWT fr

### Community 274 - "Community 274"
Cohesion: 1.0
Nodes (1): Dependency that returns an InsForge client with Admin privileges (Service Role).

### Community 275 - "Community 275"
Cohesion: 1.0
Nodes (1): # IMPORTANT: If is_verified is EXPLICITLY False in DB, we block them.

### Community 276 - "Community 276"
Cohesion: 1.0
Nodes (1): Generates a semantic embedding for the given text using the modern GenAI SDK.

### Community 277 - "Community 277"
Cohesion: 1.0
Nodes (1): Generates multiple semantic embeddings in batches using the modern GenAI SDK.

### Community 278 - "Community 278"
Cohesion: 1.0
Nodes (1): Formats hotel metadata into a rich string for semantic embedding.

### Community 279 - "Community 279"
Cohesion: 1.0
Nodes (1): Formats room type metadata into a rich string for semantic embedding.

### Community 280 - "Community 280"
Cohesion: 1.0
Nodes (1): Normalizes a vendor name by removing clutter and mapping to canonical forms.

### Community 281 - "Community 281"
Cohesion: 1.0
Nodes (1): Standardize DataForSEO reviews_breakdown to internal schema.

### Community 282 - "Community 282"
Cohesion: 1.0
Nodes (1): Submits a batch of hotel info tasks to DataForSEO.     Includes the pingback_url

### Community 283 - "Community 283"
Cohesion: 1.0
Nodes (1): # IMPORTANT: Update this with your actual Vercel deployment domain

### Community 284 - "Community 284"
Cohesion: 1.0
Nodes (1): Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic

## Knowledge Gaps
- **216 isolated node(s):** `DataForSEO Pingback handler.     When a task is ready, DataForSEO sends a POST w`, `Returns current user info.`, `Unified endpoint for base /api/auth calls (SDK compatibility).`, `Internal SDK endpoint for session synchronization.`, `SDK Token Refresh bridge.` (+211 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 35`** (5 nodes): `layout.tsx`, `LandingGroupLayout()`, `ThemeProvider()`, `theme.tsx`, `useTheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (4 nodes): `page.tsx`, `useMarketForecast.ts`, `useMarketForecast()`, `MarketIntelligencePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (4 nodes): `page.tsx`, `useAuth.ts`, `useAuth()`, `DebugDataPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `page.tsx`, `handleSubmit()`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `cleanup_hotels.py`, `Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L`, `# IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `canonicalize_db.py`, `canonicalize_hotels()`, `1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `test_firecrawl.py`, `main()`, `test_scrape()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `test_dfs_submit.py`, `Diagnostic script: Tests the exact DataForSEO task_post call  that submit_hotel_`, `test_submit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `diagnose_scan_failure.py`, `main()`, `Diagnostic script: probe DataForSEO API directly with a recent task ID to unders`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `import_discovered.py`, `import_hotels()`, `Import Discovered Hotels Script Indexes hotels from SerpApi search results into`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (3 nodes): `page.tsx`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (3 nodes): `RevealSection()`, `useScrollReveal()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 153`** (2 nodes): `Admin Services Package ====================== Re-exports all admin service funct`, `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 242`** (1 nodes): `Runs the maintenance cycle using a native database function for efficiency.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 243`** (1 nodes): `Fetch price and metadata for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 244`** (1 nodes): `Search for hotels based on a query string.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 245`** (1 nodes): `Fetch detailed information for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 246`** (1 nodes): `Return the unique name of this provider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 247`** (1 nodes): `Retrieve results for a previously submitted task.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 248`** (1 nodes): `Check if the provider is healthy (credentials valid, API reachable).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 249`** (1 nodes): `Returns the cached mappings, refreshing if expired.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 250`** (1 nodes): `Fetches fresh config from Supabase.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 252`** (1 nodes): `Fetch all tiers from DB with local caching.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 253`** (1 nodes): `Return the limits for a specific user profile.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 254`** (1 nodes): `Check if user can add more hotels based on dynamic plan limits.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 258`** (1 nodes): `Normalizes a vendor name by removing clutter and mapping to canonical forms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 268`** (1 nodes): `Main logic for assembling the dashboard data.     Performes security checks, fet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 269`** (1 nodes): `Fetches anonymized recent price drops discovered by the Global Pulse network.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 270`** (1 nodes): `Extracts the Bearer token from the Authorization header or query parameter.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 271`** (1 nodes): `Verify that the request is made by an Admin.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 272`** (1 nodes): `Verify that the user is logged in AND has an active approval status.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 273`** (1 nodes): `Dependency that returns an InsForge client with RLS enabled.     Uses the JWT fr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 274`** (1 nodes): `Dependency that returns an InsForge client with Admin privileges (Service Role).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 275`** (1 nodes): `# IMPORTANT: If is_verified is EXPLICITLY False in DB, we block them.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 276`** (1 nodes): `Generates a semantic embedding for the given text using the modern GenAI SDK.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 277`** (1 nodes): `Generates multiple semantic embeddings in batches using the modern GenAI SDK.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 278`** (1 nodes): `Formats hotel metadata into a rich string for semantic embedding.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 279`** (1 nodes): `Formats room type metadata into a rich string for semantic embedding.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 280`** (1 nodes): `Normalizes a vendor name by removing clutter and mapping to canonical forms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 281`** (1 nodes): `Standardize DataForSEO reviews_breakdown to internal schema.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 282`** (1 nodes): `Submits a batch of hotel info tasks to DataForSEO.     Includes the pingback_url`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 283`** (1 nodes): `# IMPORTANT: Update this with your actual Vercel deployment domain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 284`** (1 nodes): `Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Alert` connect `Community 12` to `Community 1`, `Community 7`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `downloadPdf()` connect `Community 12` to `Community 6`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `get_insforge_db()` connect `Community 5` to `Community 0`, `Community 1`, `Community 10`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 155 inferred relationships involving `str` (e.g. with `global_exception_handler()` and `system_report()`) actually correct?**
  _`str` has 155 INFERRED edges - model-reasoned connections that need verification._
- **Are the 123 inferred relationships involving `ProviderFactory` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`ProviderFactory` has 123 INFERRED edges - model-reasoned connections that need verification._
- **Are the 112 inferred relationships involving `AdminLog` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminLog` has 112 INFERRED edges - model-reasoned connections that need verification._
- **Are the 110 inferred relationships involving `AdminStats` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminStats` has 110 INFERRED edges - model-reasoned connections that need verification._