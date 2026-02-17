from fastapi import APIRouter, Depends
from typing import List, Optional, Any
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_admin_user
from backend.services.hotel_service import sync_directory_manual_logic
from backend.models.schemas import (
    AdminStats, AdminUser, AdminUserCreate, AdminUserUpdate, 
    AdminDirectoryEntry, AdminLog, MembershipPlan, PlanCreate, PlanUpdate
)
from backend.services.admin_service import (
    get_admin_stats_logic,
    get_admin_providers_logic,
    get_api_key_status_logic,
    force_rotate_api_key_logic,
    reset_api_keys_logic,
    reload_api_keys_logic,
    admin_update_user_logic,
    get_admin_users_logic,
    get_admin_directory_logic,
    create_admin_user_logic,
    delete_admin_user_logic,
    add_admin_directory_entry_logic,
    delete_admin_directory_logic,
    update_admin_directory_logic,
    get_admin_logs_logic,
    get_admin_feed_logic,
    get_admin_hotels_logic,
    update_admin_hotel_logic,
    delete_admin_hotel_logic,
    get_admin_scans_logic,
    get_admin_scan_details_logic,
    get_admin_settings_logic,
    update_admin_settings_logic,
    get_admin_plans_logic,
    create_admin_plan_logic,
    update_admin_plan_logic,
    delete_admin_plan_logic,
    sync_hotel_directory_logic,
    cleanup_test_data_logic,
    get_admin_market_intelligence_logic,
    get_scheduler_queue_logic,
    get_admin_providers_logic
)
from backend.services.provider_factory import ProviderFactory
import os

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/debug-providers")
async def debug_providers():
    """
    Diagnostic endpoint to verify data provider status.
    Returns which providers (SerpApi, RapidAPI) are registered and active.
    Used for troubleshooting credential issues and primary provider selection.
    """
    # EXPLANATION: Admin Diagnostics
    # Provides health status of external scrapers and database connectivity.
    providers = ProviderFactory.get_active_providers()
    return {
        "active_providers": [p.get_provider_name() for p in providers],
        "registered_count": len(providers),
        "primary_provider": providers[0].get_provider_name() if providers else "None",
        "env_check": {
            "SERPAPI": bool(os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")),
            "RAPIDAPI": bool(os.getenv("RAPIDAPI_KEY")),
        }
        }


@router.get("/providers")
async def get_admin_providers(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Returns the list of network providers and their status for the API Keys panel.
    
    EXPLANATION: Missing Endpoint Fix
    The ApiKeysPanel calls /api/admin/providers to list active scrapers. 
    This route was missing, causing a 404 and breaking the entire panel.
    """
    return await get_admin_providers_logic()

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Fetches high-level system statistics for the Admin Dashboard.
    Includes total users, active hotels, and current scan counts.
    Delegates calculation logic to admin_service.
    """
    # EXPLANATION: Admin Dashboard Metrics
    # Powers the top-level stats tiles in the Admin Overview.
    return await get_admin_stats_logic(db)

@router.get("/api-keys/status")
async def get_api_key_status(user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """
    Checks the validity and remaining quota of configured external API keys.
    Essential for monitoring budget and operational continuity.
    """
    # EXPLANATION: Quota Management
    # Synchronizes frontend key status with backend-managed rotation.
    return await get_api_key_status_logic(db)

@router.post("/api-keys/rotate")
async def force_rotate_api_key(user: Any = Depends(get_current_admin_user)):
    """
    Manually triggers rotation of API keys if provided.
    Implements a fallback mechanism to ensure at least one key is always active.
    """
    return await force_rotate_api_key_logic()

@router.post("/api-keys/reset")
async def reset_api_keys(user: Any = Depends(get_current_admin_user)):
    """
    Clears key usage history. Used for monthly resets or manual maintenance.
    """
    return await reset_api_keys_logic()

@router.post("/api-keys/reload")
async def reload_api_keys(user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """
    Reloads API keys from environment/vault without restarting the service.
    """
    return await reload_api_keys_logic()

@router.patch("/users/{user_id}")
async def admin_update_user(user_id: UUID, updates: AdminUserUpdate, user: Any = Depends(get_current_admin_user), db: Client = Depends(get_supabase)):
    """
    Directly updates a user profile from the admin interface.
    Used for managing subscriptions, roles, and manual status overrides.
    """
    # EXPLANATION: User Lifecycle Management
    # Directly propagates plan and status changes from the Admin Panel.
    return await admin_update_user_logic(user_id, updates, db)

@router.get("/users", response_model=List[AdminUser])
async def get_admin_users(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Lists all users in the system with their roles and subscription status.
    Provides the core user management view for Tripzy admins.
    """
    return await get_admin_users_logic(db)

@router.get("/directory", response_model=List[AdminDirectoryEntry])
async def get_admin_directory(limit: int = 100, city: Optional[str] = None, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Retrieves the global hotel directory. 
    This is the source of truth for "Discovery" and "Cold Start" hotel lookups.
    Supports filtering by city for targeted intelligence.
    """
    # EXPLANATION: Universal Directory Access
    # Allows admins to browse and manage the globally shared hotel database.
    return await get_admin_directory_logic(db, limit, city)

@router.post("/users", response_model=dict)
async def create_admin_user(user: AdminUserCreate, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Administrative user creation. Used for internal team onboarding.
    """
    return await create_admin_user_logic(user, db)

@router.delete("/users/{user_id}")
async def delete_admin_user(user_id: UUID, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Deletes a user and their associated data (hotels, scans, logs). 
    Used for compliance and account cleanup.
    """
    return await delete_admin_user_logic(user_id, db)

@router.post("/directory", response_model=dict)
async def add_admin_directory_entry(entry: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Manually injects a hotel into the global directory to improve discovery coverage.
    """
    return await add_admin_directory_entry_logic(entry, db)

@router.delete("/directory/{entry_id}")
async def delete_admin_directory(entry_id: str, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Removes a hotel from the global directory.
    """
    return await delete_admin_directory_logic(entry_id, db)

@router.put("/directory/{entry_id}")
async def update_admin_directory(entry_id: str, updates: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Updates global directory metadata (normalization, coordinate corrections).
    """
    return await update_admin_directory_logic(entry_id, updates, db)

@router.get("/logs", response_model=List[AdminLog])
async def get_admin_logs(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    System activity logs. Audit trail for administrative actions.
    """
    return await get_admin_logs_logic(limit, db)

@router.get("/feed")
async def get_admin_feed(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Real-time feed of system events (scans triggered, parity alerts).
    """
    return await get_admin_feed_logic(limit, db)

@router.get("/hotels")
async def get_admin_hotels(limit: int = 100, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Lists all hotels currently being tracked across all users.
    """
    return await get_admin_hotels_logic(db, limit)

@router.get("/scans", response_model=List[dict])
async def get_admin_scans(limit: int = 50, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Lists global scan history. Essential for monitoring scraper health.
    """
    return await get_admin_scans_logic(db, limit)

@router.get("/scans/{scan_id}")
async def get_admin_scan_details(scan_id: UUID, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Fetches detailed logs for a specific scan session.
    """
    return await get_admin_scan_details_logic(scan_id, db)

@router.put("/hotels/{hotel_id}")
async def update_admin_hotel(hotel_id: str, updates: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Updates a hotel record globally.
    """
    return await update_admin_hotel_logic(hotel_id, updates, db)

@router.delete("/hotels/{hotel_id}")
async def delete_admin_hotel(hotel_id: str, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Deletes a hotel and its associated data globally.
    """
    return await delete_admin_hotel_logic(hotel_id, db)

@router.get("/plans", response_model=List[MembershipPlan])
async def get_admin_plans(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Lists all subscription plans.
    """
    return await get_admin_plans_logic(db)

@router.post("/plans", response_model=MembershipPlan)
async def create_admin_plan(plan: PlanCreate, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Creates a new subscription plan.
    """
    return await create_admin_plan_logic(plan, db)

@router.put("/plans/{plan_id}", response_model=MembershipPlan)
async def update_admin_plan(plan_id: UUID, plan: PlanUpdate, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Updates an existing subscription plan.
    """
    return await update_admin_plan_logic(plan_id, plan, db)

@router.delete("/plans/{plan_id}")
async def delete_admin_plan(plan_id: UUID, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Deletes a subscription plan.
    """
    return await delete_admin_plan_logic(plan_id, db)

@router.get("/global-settings")
@router.get("/settings")
async def get_admin_settings(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Fetches global application parameters (maintenance mode, signup flags).
    """
    return await get_admin_settings_logic(db)

@router.post("/global-settings")
@router.put("/settings")
async def update_admin_settings(settings: dict, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Persists global application parameter changes.
    """
    # EXPLANATION: Global Configuration
    # Controls system-wide flags like Maintenance Mode via the UI.
    return await update_admin_settings_logic(settings, db)

@router.post("/sync")
async def sync_directory(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Triggers a manual sync between user hotels and the global directory.
    Uses the consolidated sync_hotel_directory_logic for stability.
    """
    # EXPLANATION: Manual Directory Sync
    # Merges unique user-added hotels into the global searchable directory.
    return await sync_hotel_directory_logic(db)

@router.post("/cleanup-test-data")
async def cleanup_test_data(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Removes test records and artifacts from the system.
    """
    return await cleanup_test_data_logic(db)

@router.get("/market-intelligence")
async def get_market_intelligence(city: Optional[str] = None, db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Fetches city-level market intelligence for the admin Intelligence tab.
    
    EXPLANATION: Corrected Route Handler
    Previously this called get_admin_stats_logic(db) which returns AdminStats 
    (total_users, total_hotels, etc.), but the frontend AnalyticsPanel expects 
    { hotels: [...], summary: { hotel_count, avg_price, price_range, scan_coverage_pct } }.
    Now correctly calls get_admin_market_intelligence_logic with city filter.
    """
    return await get_admin_market_intelligence_logic(db, city)

@router.get("/scheduler/queue")
async def get_scheduler_queue(db: Client = Depends(get_supabase), admin=Depends(get_current_admin_user)):
    """
    Returns the list of users with scheduled scans for the admin Upcoming Queue tab.
    
    EXPLANATION: Missing Endpoint Implementation
    The ScansPanel frontend component calls /api/admin/scheduler/queue but this 
    route was never created. Without it, the queue silently failed and always 
    showed 'No scheduled scans found'.
    """
    return await get_scheduler_queue_logic(db)
