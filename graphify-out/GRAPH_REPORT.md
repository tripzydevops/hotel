# Graph Report - hotel  (2026-05-01)

## Corpus Check
- 402 files · ~254,542 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1867 nodes · 4738 edges · 70 communities detected
- Extraction: 34% EXTRACTED · 66% INFERRED · 0% AMBIGUOUS · INFERRED: 3120 edges (avg confidence: 0.55)
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
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 207|Community 207]]
- [[_COMMUNITY_Community 208|Community 208]]
- [[_COMMUNITY_Community 209|Community 209]]
- [[_COMMUNITY_Community 210|Community 210]]
- [[_COMMUNITY_Community 211|Community 211]]
- [[_COMMUNITY_Community 212|Community 212]]
- [[_COMMUNITY_Community 213|Community 213]]
- [[_COMMUNITY_Community 214|Community 214]]
- [[_COMMUNITY_Community 215|Community 215]]
- [[_COMMUNITY_Community 216|Community 216]]
- [[_COMMUNITY_Community 217|Community 217]]
- [[_COMMUNITY_Community 218|Community 218]]
- [[_COMMUNITY_Community 222|Community 222]]
- [[_COMMUNITY_Community 235|Community 235]]
- [[_COMMUNITY_Community 236|Community 236]]
- [[_COMMUNITY_Community 237|Community 237]]
- [[_COMMUNITY_Community 238|Community 238]]
- [[_COMMUNITY_Community 239|Community 239]]
- [[_COMMUNITY_Community 240|Community 240]]
- [[_COMMUNITY_Community 241|Community 241]]
- [[_COMMUNITY_Community 242|Community 242]]
- [[_COMMUNITY_Community 243|Community 243]]
- [[_COMMUNITY_Community 244|Community 244]]
- [[_COMMUNITY_Community 245|Community 245]]
- [[_COMMUNITY_Community 246|Community 246]]
- [[_COMMUNITY_Community 247|Community 247]]
- [[_COMMUNITY_Community 248|Community 248]]
- [[_COMMUNITY_Community 249|Community 249]]
- [[_COMMUNITY_Community 250|Community 250]]

## God Nodes (most connected - your core abstractions)
1. `ProviderFactory` - 162 edges
2. `AdminStats` - 149 edges
3. `AdminUser` - 149 edges
4. `AdminDirectoryEntry` - 149 edges
5. `AdminLog` - 149 edges
6. `SystemLogEntry` - 149 edges
7. `SystemLogsResponse` - 149 edges
8. `HealthMetrics` - 149 edges
9. `AdminUserCreate` - 148 edges
10. `AdminUserUpdate` - 148 edges

## Surprising Connections (you probably didn't know these)
- `test_ids()` --calls--> `DataForSEOProvider`  [INFERRED]
  test_ids.py → backend/services/providers/dataforseo_provider.py
- `test_historical_data()` --calls--> `get_insforge_db()`  [INFERRED]
  reproduce_calendar_bug.py → backend/utils/db.py
- `find()` --calls--> `get_supabase()`  [INFERRED]
  find_hotel_ids.py → backend/scripts/heal_embeddings.py
- `handleDestroyKey()` --calls--> `Alert`  [INFERRED]
  components/admin/ApiKeysPanel.tsx → backend/models/schemas.py
- `handleRotate()` --calls--> `Alert`  [INFERRED]
  components/admin/ApiKeysPanel.tsx → backend/models/schemas.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (173): Phase 1: Persists raw scraper data and performs basic heuristic analysis (ARI, b, Phase 2: Deep AI Reasoning (Market Intelligence).         This is slower and use, Analyst Agent.     Specialized in price analytics, trend detection, and multi-ho, Background task to update a user's pricing DNA for a specific property., Legacy wrapper for backward compatibility., Helper to extract pulse data and dispatch background alerts., VECTOR SEARCH Logic for ghost competitor discovery with geographical filtering., Buffer a log entry in memory for batch processing later. (+165 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (197): AnalystAgent, Runs the Gemini 3 agentic reasoning flow over current scan results.         Dele, High-level orchestration for batch market analysis.         Generates analysis a, Uses Gemini 3 to generate a sharp, executive-level pulse card rationale., Agent responsible for data acquisition from SerpApi., Performs the actual scraping for a list of hotels., Buffer a log entry in memory for batch processing later., Batch update the reasoning trace to the database in a single round-trip. (+189 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (166): Fetches high-level system statistics for the Admin Dashboard.     Includes total, Fetches high-level system statistics for the Admin Dashboard.     Includes total, Directly updates a user profile from the admin interface.     Used for managing, Directly updates a user profile from the admin interface.     Used for managing, Lists all users in the system with their roles and subscription status.     Prov, Lists all users in the system with their roles and subscription status.     Prov, Retrieves the global hotel directory.     This is the source of truth for "Disco, Retrieves the global hotel directory.     This is the source of truth for "Disco (+158 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (103): ABC, test_ids(), HotelDataProvider, DataForSEOProvider, Submits a batch of hotels for discovery.         Returns the number of tasks suc, Submits a batch of hotels for discovery.         Returns the number of tasks suc, Internal helper to log raw payload to the Everything Vault., Helper to register external tasks into internal scan_tasks table. (+95 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (103): execute_strategy_bridge(), ExecutionRequest, [Future-Proofing] Webhook listener for AI-recommended actions.     Prepares for, create_hotel(), delete_hotel(), list_hotels(), list_locations(), Creates a hotel with plan-based limits, profile self-healing, and     token disc (+95 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (5): fetchBrief(), handleSaveSettings(), ApiClient, fetchPulse(), fetchStats()

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (77): add_admin_directory_entry(), admin_update_user(), cleanup_empty_scans(), cleanup_test_data(), create_admin_plan(), create_admin_user(), debug_providers(), delete_admin_directory() (+69 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (25): DataForSEOClient, DataForSEO Client for Hotel Metadata Enrichment Fetches detailed hotel informati, Map DataForSEO result fields to internal format., Client for interacting with DataForSEO API to get rich hotel metadata., Generate Basic Auth header., Fetch hotel details using Google Maps Business Data API., NotificationService, Notification Service Handles sending email notifications for alerts. (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (22): handleDestroyKey(), handleReload(), handleReset(), handleRotate(), loadKeyStatus(), handleDelete(), handleSave(), loadPlans() (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (28): auth_root_sync(), auth_token_bridge(), get_current_session(), get_current_session_v1(), get_user_info(), get_user_info_v1(), Returns current user info., Unified endpoint for base /api/auth calls (SDK compatibility). (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (14): global_exception_handler(), Hotel Rate Monitor - FastAPI Backend Main entry point using modular routers. Red, Global exception handler for all unhandled errors.     Ensures internal tracing, Global exception handler for all unhandled errors.     Ensures internal tracing, Deep diagnostics for environment and database connectivity., Deep diagnostics for environment and database connectivity., Startup health check., Startup health check. (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (6): formatCurrency(), parsePrice(), getCurrencySymbol(), handleExport(), ParityHealthSection(), HotelTile()

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (7): MarketIntelligenceService, MockTypes, Generates a city-level market briefing in Markdown format., Generates a vector embedding for the given text., Market Intelligence Service.     Uses Gemini to synthesize market data into acti, Summarizes market data into high-level insights using Gemini., TestAIResilience

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (5): AdvisorQuadrant(), SentimentBattlefield(), MarketInsight(), useI18n(), TargetHotelTile()

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (7): get_network_stats(), [Global Pulse Phase 2] — Pulse Routes API endpoints for the Global Pulse network, Returns live Global Pulse network metrics.     Used by GlobalPulseFeed.tsx to di, test_stats(), get_pulse_network_stats(), [Global Pulse Phase 2] — Pulse Service Provides network-wide intelligence stats, Returns live network metrics for the Global Pulse dashboard widget.     Cached f

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (4): useDashboard(), useProfile(), useSettings(), useToast()

### Community 16 - "Community 16"
Cohesion: 0.31
Nodes (8): get_auth_header(), main(), main_async(), process_concurrent_batch(), Enrich Hotel Directory with GPS Coordinates ====================================, Process a batch of hotels concurrently (max 5 concurrent requests)., Search Google Maps for a single hotel and return coordinates., search_hotel_maps()

### Community 17 - "Community 17"
Cohesion: 0.31
Nodes (8): extract_from_booking_url(), extract_from_expedia_url(), extract_from_tripadvisor_url(), extract_hotel_data_from_url(), Extracts the location ID (g-code) and hotel ID (d-code) from a Tripadvisor URL., Extracts the hotel ID (h-code) from an Expedia or Hotels.com URL.     Returns:, Determines the OTA vendor from the URL and extracts identifying hotel data., Extracts the hotel slug from a Booking.com URL.     Returns:         dict with '

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): api_generate_dispute(), DisputeRequest, Generates an AI-powered dispute letter for a parity violation., generate_dispute_letter(), get_genai_client(), Recovery Service. Handles AI-powered dispute generation for parity violations.

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (5): PredictiveService, Predictive Yield Service Calculates market volatility and suggests dynamic alert, EXPLANATION: Volatility-Aware Intelligence (Kaizen 2026)     The predictive serv, Calculate volatility (Standard Deviation of daily price changes) for a hotel., Apply volatility-aware adjustment to the base threshold.          Formula:

### Community 20 - "Community 20"
Cohesion: 0.38
Nodes (3): AnimatedCounter(), RevealSection(), useScrollReveal()

### Community 22 - "Community 22"
Cohesion: 0.6
Nodes (5): main(), process_hotel_results(), Bulk Hotel Scanner using SerpApi Scrapes hotels from Google Hotels via SerpApi f, scan_city_by_stars(), scan_custom_query()

### Community 23 - "Community 23"
Cohesion: 0.47
Nodes (5): enrich_coords(), fetch_results(), Submits a batch of 100 tasks to DataForSEO., Wait and fetch results for a specific task_id., submit_batch()

### Community 25 - "Community 25"
Cohesion: 0.7
Nodes (4): extract_from_booking_url(), extract_from_expedia_url(), extract_from_tripadvisor_url(), extract_hotel_data()

### Community 29 - "Community 29"
Cohesion: 0.6
Nodes (4): main(), process_results(), Brand Scan Script Scans for specific major hotel chains in Turkey to ensure high, scan_brand()

### Community 30 - "Community 30"
Cohesion: 0.8
Nodes (4): clean_name(), load_hotels(), load_locations(), main()

### Community 31 - "Community 31"
Cohesion: 0.4
Nodes (2): LandingGroupLayout(), useTheme()

### Community 33 - "Community 33"
Cohesion: 0.83
Nodes (3): check_tailwind_version(), main(), scan_file_for_violations()

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (2): useMarketForecast(), MarketIntelligencePage()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (3): enrich_locations(), live_location_search(), Fallback to live DataForSEO API if local lookup fails.

### Community 43 - "Community 43"
Cohesion: 0.83
Nodes (3): check_hotel_limit(), get_all_tiers(), get_user_limits()

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (2): useAuth(), DebugDataPage()

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (2): RevealSection(), useScrollReveal()

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (2): Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L, # IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (2): canonicalize_hotels(), 1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): main(), test_scrape()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (1): Diagnostic script: probe DataForSEO API directly with a recent task ID to unders

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (1): Import Discovered Hotels Script Indexes hotels from SerpApi search results into

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (2): Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic, run_dataforseo_flow()

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (2): RevealSection(), useScrollReveal()

### Community 207 - "Community 207"
Cohesion: 1.0
Nodes (1): Runs the maintenance cycle using a native database function for efficiency.

### Community 208 - "Community 208"
Cohesion: 1.0
Nodes (1): Fetch price and metadata for a specific hotel.

### Community 209 - "Community 209"
Cohesion: 1.0
Nodes (1): Search for hotels based on a query string.

### Community 210 - "Community 210"
Cohesion: 1.0
Nodes (1): Fetch detailed information for a specific hotel.

### Community 211 - "Community 211"
Cohesion: 1.0
Nodes (1): Return the unique name of this provider

### Community 212 - "Community 212"
Cohesion: 1.0
Nodes (1): Retrieve results for a previously submitted task.

### Community 213 - "Community 213"
Cohesion: 1.0
Nodes (1): Check if the provider is healthy (credentials valid, API reachable).

### Community 214 - "Community 214"
Cohesion: 1.0
Nodes (1): Returns the cached mappings, refreshing if expired.

### Community 215 - "Community 215"
Cohesion: 1.0
Nodes (1): Fetches fresh config from Supabase.

### Community 216 - "Community 216"
Cohesion: 1.0
Nodes (1): Fetch all tiers from DB with local caching.

### Community 217 - "Community 217"
Cohesion: 1.0
Nodes (1): Return the limits for a specific user profile.

### Community 218 - "Community 218"
Cohesion: 1.0
Nodes (1): Check if user can add more hotels based on dynamic plan limits.

### Community 222 - "Community 222"
Cohesion: 1.0
Nodes (1): Normalizes a vendor name by removing clutter and mapping to canonical forms.

### Community 235 - "Community 235"
Cohesion: 1.0
Nodes (1): Uses Gemini 3 to parse raw TGA content into structured market events.

### Community 236 - "Community 236"
Cohesion: 1.0
Nodes (1): Uses Gemini 3 to parse raw TOBB markdown/table content into structured market ev

### Community 237 - "Community 237"
Cohesion: 1.0
Nodes (1): High-Performance Batch Sync.         Groups results by property_token (identity)

### Community 238 - "Community 238"
Cohesion: 1.0
Nodes (1): Generate Basic Auth header.

### Community 239 - "Community 239"
Cohesion: 1.0
Nodes (1): Fetch hotel details using Google Maps Business Data API.

### Community 240 - "Community 240"
Cohesion: 1.0
Nodes (1): Map DataForSEO result fields to internal format.

### Community 241 - "Community 241"
Cohesion: 1.0
Nodes (1): Check if the provider is healthy (credentials valid, API reachable).

### Community 242 - "Community 242"
Cohesion: 1.0
Nodes (1): High-Performance Batch Sync.         Groups results by property_token (identity)

### Community 243 - "Community 243"
Cohesion: 1.0
Nodes (1): Generates a high-level strategic verdict based on pricing (ARI) and sentiment.

### Community 244 - "Community 244"
Cohesion: 1.0
Nodes (1): Cleans markdown JSON fencing from LLM output.

### Community 245 - "Community 245"
Cohesion: 1.0
Nodes (1): Core AI logic for market anomaly detection and strategic reasoning.     Uses Gem

### Community 246 - "Community 246"
Cohesion: 1.0
Nodes (1): Fallback logic for market intelligence.

### Community 247 - "Community 247"
Cohesion: 1.0
Nodes (1): Synthesizes a hotel's 'Pricing DNA' from historical performance logs.

### Community 248 - "Community 248"
Cohesion: 1.0
Nodes (1): Converts the Pricing DNA narrative into a vector embedding for retrieval groundi

### Community 249 - "Community 249"
Cohesion: 1.0
Nodes (1): Step 2: Generate the Gemini 3 narrative using the interactions streaming API.

### Community 250 - "Community 250"
Cohesion: 1.0
Nodes (1): Checks if a user owns a specific hotel via the user_hotels mapping table.

## Knowledge Gaps
- **210 isolated node(s):** `DataForSEO Pingback handler.     When a task is ready, DataForSEO sends a POST w`, `Returns current user info.`, `Unified endpoint for base /api/auth calls (SDK compatibility).`, `Internal SDK endpoint for session synchronization.`, `SDK Token Refresh bridge.` (+205 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 31`** (5 nodes): `layout.tsx`, `LandingGroupLayout()`, `ThemeProvider()`, `theme.tsx`, `useTheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (4 nodes): `page.tsx`, `useMarketForecast.ts`, `useMarketForecast()`, `MarketIntelligencePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (4 nodes): `page.tsx`, `useAuth.ts`, `useAuth()`, `DebugDataPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (4 nodes): `page.tsx`, `handleSubmit()`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (3 nodes): `cleanup_hotels.py`, `Script to delete 'orphaned' hotels from the database.  CRITICAL SAFETY GUARDS (L`, `# IMPORTANT: We use admin=True to bypass RLS and see ALL hotels for cleanup.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (3 nodes): `canonicalize_db.py`, `canonicalize_hotels()`, `1. Identifies duplicate hotels (case-insensitive name match).     2. Consolidate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `test_firecrawl.py`, `main()`, `test_scrape()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `diagnose_scan_failure.py`, `main()`, `Diagnostic script: probe DataForSEO API directly with a recent task ID to unders`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `import_discovered.py`, `import_hotels()`, `Import Discovered Hotels Script Indexes hotels from SerpApi search results into`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `dfseo_2step_test.py`, `Performs the 2-step DataForSEO workflow:     1. GET /locations to find the offic`, `run_dataforseo_flow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `page.tsx`, `RevealSection()`, `useScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `RevealSection()`, `useScrollReveal()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 207`** (1 nodes): `Runs the maintenance cycle using a native database function for efficiency.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 208`** (1 nodes): `Fetch price and metadata for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 209`** (1 nodes): `Search for hotels based on a query string.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 210`** (1 nodes): `Fetch detailed information for a specific hotel.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 211`** (1 nodes): `Return the unique name of this provider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 212`** (1 nodes): `Retrieve results for a previously submitted task.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 213`** (1 nodes): `Check if the provider is healthy (credentials valid, API reachable).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 214`** (1 nodes): `Returns the cached mappings, refreshing if expired.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 215`** (1 nodes): `Fetches fresh config from Supabase.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 216`** (1 nodes): `Fetch all tiers from DB with local caching.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 217`** (1 nodes): `Return the limits for a specific user profile.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 218`** (1 nodes): `Check if user can add more hotels based on dynamic plan limits.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 222`** (1 nodes): `Normalizes a vendor name by removing clutter and mapping to canonical forms.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 235`** (1 nodes): `Uses Gemini 3 to parse raw TGA content into structured market events.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 236`** (1 nodes): `Uses Gemini 3 to parse raw TOBB markdown/table content into structured market ev`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 237`** (1 nodes): `High-Performance Batch Sync.         Groups results by property_token (identity)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 238`** (1 nodes): `Generate Basic Auth header.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 239`** (1 nodes): `Fetch hotel details using Google Maps Business Data API.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 240`** (1 nodes): `Map DataForSEO result fields to internal format.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 241`** (1 nodes): `Check if the provider is healthy (credentials valid, API reachable).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 242`** (1 nodes): `High-Performance Batch Sync.         Groups results by property_token (identity)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 243`** (1 nodes): `Generates a high-level strategic verdict based on pricing (ARI) and sentiment.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 244`** (1 nodes): `Cleans markdown JSON fencing from LLM output.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 245`** (1 nodes): `Core AI logic for market anomaly detection and strategic reasoning.     Uses Gem`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 246`** (1 nodes): `Fallback logic for market intelligence.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 247`** (1 nodes): `Synthesizes a hotel's 'Pricing DNA' from historical performance logs.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 248`** (1 nodes): `Converts the Pricing DNA narrative into a vector embedding for retrieval groundi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 249`** (1 nodes): `Step 2: Generate the Gemini 3 narrative using the interactions streaming API.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 250`** (1 nodes): `Checks if a user owns a specific hotel via the user_hotels mapping table.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Alert` connect `Community 8` to `Community 4`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `downloadPdf()` connect `Community 8` to `Community 5`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `get_insforge_db()` connect `Community 0` to `Community 1`, `Community 3`, `Community 9`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 161 inferred relationships involving `ProviderFactory` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`ProviderFactory` has 161 INFERRED edges - model-reasoned connections that need verification._
- **Are the 147 inferred relationships involving `AdminStats` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminStats` has 147 INFERRED edges - model-reasoned connections that need verification._
- **Are the 147 inferred relationships involving `AdminUser` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminUser` has 147 INFERRED edges - model-reasoned connections that need verification._
- **Are the 147 inferred relationships involving `AdminDirectoryEntry` (e.g. with `Diagnostic endpoint to verify data provider status.     Returns which providers` and `Returns the list of network providers and their status for the API Keys panel.`) actually correct?**
  _`AdminDirectoryEntry` has 147 INFERRED edges - model-reasoned connections that need verification._