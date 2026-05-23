
from backend.models.schemas import AdminDataResponse, AdminSettings, AdminUser, Hotel, ProviderHealth, ScanSession, SchedulerQueueEntry, SuccessResponse
import os
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.models.schemas import (
    AdminDirectoryEntry,
    AdminLog,
    AdminStats,
    AdminUser,
    AdminUserCreate,
    AdminUserUpdate,
    MembershipPlan,
    PlanCreate,
    PlanUpdate,
    HealthMetrics,
    SystemLogEntry,
    SystemLogsResponse,
)
from backend.services.admin import (
    add_admin_directory_entry_logic,
    admin_update_user_logic,
    cleanup_empty_scans_logic,
    cleanup_test_data_logic,
    create_admin_plan_logic,
    create_admin_user_logic,
    delete_admin_directory_logic,
    delete_admin_hotel_logic,
    delete_admin_plan_logic,
    delete_admin_user_logic,
    get_admin_batch_details_logic,
    get_admin_batches_logic,
    get_admin_directory_logic,
    get_admin_feed_logic,
    get_admin_hotels_logic,
    get_admin_logs_logic,
    get_system_logs_logic,
    get_admin_market_intelligence_logic,
    get_admin_plans_logic,
    get_admin_providers_logic,
    get_admin_scan_details_logic,
    get_admin_scans_logic,
    get_admin_scan_export_logic,
    get_admin_settings_logic,
    get_admin_stats_logic,
    get_admin_users_logic,
    get_scheduler_queue_logic,
    rescan_batch_task_logic,
    sync_hotel_directory_logic,
    sync_user_profiles_logic,
    sync_all_logic,
    trigger_all_overdue_logic,
    update_admin_directory_logic,
    update_admin_hotel_logic,
    update_admin_plan_logic,
    update_admin_settings_logic,
    get_admin_market_heartbeats_logic,
)
from backend.services.auth_service import get_current_admin_user, get_supabase_admin
from backend.services.provider_factory import ProviderFactory

from supabase import Client

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/debug-providers", response_model=Dict[str, Any])
async def debug_providers(admin=Depends(get_current_admin_user)):
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
        },
    }


@router.get("/providers", response_model=List[ProviderHealth])
async def get_admin_providers(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Returns the list of network providers and their status for the API Keys panel.

    EXPLANATION: Missing Endpoint Fix
    The ApiKeysPanel calls /api/admin/providers to list active scrapers.
    This route was missing, causing a 404 and breaking the entire panel.
    """
    return await get_admin_providers_logic()


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Fetches high-level system statistics for the Admin Dashboard.
    Includes total users, active hotels, and current scan counts.
    Delegates calculation logic to admin_service.
    """
    # EXPLANATION: Admin Dashboard Metrics
    # Powers the top-level stats tiles in the Admin Overview.
    return await get_admin_stats_logic(db)


# API Key management routes removed (migrated to DataForSEO)


@router.patch("/users/{user_id}", response_model=AdminUser)
async def admin_update_user(
    user_id: UUID,
    updates: AdminUserUpdate,
    user: Any = Depends(get_current_admin_user),
    db: Client = Depends(get_supabase_admin),
):
    """
    Directly updates a user profile from the admin interface.
    Used for managing subscriptions, roles, and manual status overrides.
    """
    # EXPLANATION: User Lifecycle Management
    # Directly propagates plan and status changes from the Admin Panel.
    return await admin_update_user_logic(user_id, updates, db)


@router.get("/users", response_model=List[AdminUser])
async def get_admin_users(
    q: Optional[str] = None,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Lists all users in the system with their roles and subscription status.
    Provides the core user management view for Tripzy admins.
    """
    return await get_admin_users_logic(db, q=q)


@router.get("/directory", response_model=List[AdminDirectoryEntry])
async def get_admin_directory(
    limit: int = 100,
    city: Optional[str] = None,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Retrieves the global hotel directory.
    This is the source of truth for "Discovery" and "Cold Start" hotel lookups.
    Supports filtering by city for targeted intelligence.
    """
    # EXPLANATION: Universal Directory Access
    # Allows admins to browse and manage the globally shared hotel database.
    return await get_admin_directory_logic(db, limit, city)


@router.post("/users", response_model=dict)
async def create_admin_user(
    user: AdminUserCreate,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Administrative user creation. Used for internal team onboarding.
    """
    return await create_admin_user_logic(user, db)


@router.delete("/users/{user_id}", response_model=SuccessResponse)
async def delete_admin_user(
    user_id: UUID,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Deletes a user and their associated data (hotels, scans, logs).
    Used for compliance and account cleanup.
    """
    return await delete_admin_user_logic(str(user_id), db)


@router.post("/directory", response_model=dict)
async def add_admin_directory_entry(
    entry: dict,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Manually injects a hotel into the global directory to improve discovery coverage.
    """
    return await add_admin_directory_entry_logic(entry, db)


@router.delete("/directory/{entry_id}", response_model=SuccessResponse)
async def delete_admin_directory(
    entry_id: str,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Removes a hotel from the global directory.
    """
    return await delete_admin_directory_logic(entry_id, db)


@router.put("/directory/{entry_id}", response_model=SuccessResponse)
async def update_admin_directory(
    entry_id: str,
    updates: dict,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Updates global directory metadata (normalization, coordinate corrections).
    """
    return await update_admin_directory_logic(entry_id, updates, db)


@router.get("/logs", response_model=List[AdminLog])
async def get_admin_logs(
    limit: int = 50,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    System activity logs. Audit trail for administrative actions.
    """
    return await get_admin_logs_logic(db, limit)


@router.get("/system-logs", response_model=SystemLogsResponse)
async def get_system_logs(
    limit: int = 100,
    admin=Depends(get_current_admin_user),
):
    """
    Background worker logs (scheduler.log).
    """
    return await get_system_logs_logic(limit)


@router.get("/feed", response_model=AdminDataResponse)
async def get_admin_feed(
    limit: int = 50,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Real-time feed of system events (scans triggered, parity alerts).
    """
    return await get_admin_feed_logic(limit, db)


@router.get("/hotels", response_model=List[Hotel])
async def get_admin_hotels(
    limit: int = 100,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Lists all hotels currently being tracked across all users.
    """
    return await get_admin_hotels_logic(db, limit)


@router.get("/scans", response_model=List[dict])
async def get_admin_scans(
    limit: int = 50,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Lists global scan history. Essential for monitoring scraper health.
    """
    return await get_admin_scans_logic(db, limit)


@router.get("/scans/{scan_id}/export", response_model=Dict[str, Any])
async def export_admin_scan(
    scan_id: UUID,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    KAIZEN: Raw Payload Extraction Vault Export
    Targets the raw_payload column, flattens it with pandas, and delivers a CSV.
    """
    return await get_admin_scan_export_logic(scan_id, db)


@router.get("/scans/{scan_id}", response_model=ScanSession)
async def get_admin_scan_details(
    scan_id: UUID,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Fetches detailed logs for a specific scan session.
    """
    return await get_admin_scan_details_logic(scan_id, db)


@router.put("/hotels/{hotel_id}", response_model=Hotel)
async def update_admin_hotel(
    hotel_id: str,
    updates: dict,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Updates a hotel record globally.
    """
    return await update_admin_hotel_logic(hotel_id, updates, db)


@router.delete("/hotels/{hotel_id}", response_model=SuccessResponse)
async def delete_admin_hotel(
    hotel_id: str,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Deletes a hotel and its associated data globally.
    """
    return await delete_admin_hotel_logic(hotel_id, db)


@router.get("/plans", response_model=List[MembershipPlan])
async def get_admin_plans(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Lists all subscription plans.
    """
    return await get_admin_plans_logic(db)


@router.post("/plans", response_model=MembershipPlan)
async def create_admin_plan(
    plan: PlanCreate,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Creates a new subscription plan.
    """
    return await create_admin_plan_logic(plan, db)


@router.put("/plans/{plan_id}", response_model=MembershipPlan)
async def update_admin_plan(
    plan_id: UUID,
    plan: PlanUpdate,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Updates an existing subscription plan.
    """
    return await update_admin_plan_logic(plan_id, plan, db)


@router.delete("/plans/{plan_id}", response_model=SuccessResponse)
async def delete_admin_plan(
    plan_id: UUID,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Deletes a subscription plan.
    """
    return await delete_admin_plan_logic(plan_id, db)


@router.get("/global-settings", response_model=AdminSettings)
@router.get("/settings", response_model=AdminSettings)
async def get_admin_settings(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Fetches global application parameters (maintenance mode, signup flags).
    """
    return await get_admin_settings_logic(db)


@router.get("/heartbeats", response_model=HealthMetrics)
async def get_admin_heartbeats(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Retrieves system operational heartbeats for diagnostics.
    Specifically monitors the Market Pulse scheduler performance.
    """
    return await get_admin_market_heartbeats_logic(db)


@router.post("/global-settings", response_model=AdminSettings)
@router.put("/settings", response_model=AdminSettings)
async def update_admin_settings(
    settings: dict,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Persists global application parameter changes.
    """
    # EXPLANATION: Global Configuration
    # Controls system-wide flags like Maintenance Mode via the UI.
    from backend.services.admin.system_stats import AdminSettingsUpdate
    return await update_admin_settings_logic(AdminSettingsUpdate(**settings), db)


@router.post("/sync", response_model=SuccessResponse)
async def sync_directory(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Triggers a manual sync between user hotels and the global directory.
    Uses the consolidated sync_hotel_directory_logic for stability.
    """
    # EXPLANATION: Manual Directory Sync
    # Merges unique user-added hotels into the global searchable directory.
    return await sync_hotel_directory_logic(db)


@router.post("/sync/profiles", response_model=SuccessResponse)
async def sync_profiles(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Triggers a manual sync for user profile metadata.
    """
    return await sync_user_profiles_logic(db)


@router.post("/sync/all", response_model=SuccessResponse)
async def sync_all_systems(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Triggers a full system sync (directory + profiles).
    """
    return await sync_all_logic(db)


@router.post("/cleanup-test-data", response_model=SuccessResponse)
async def cleanup_test_data(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Removes test records and artifacts from the system.
    """
    return await cleanup_test_data_logic(db)


@router.get("/market-intelligence", response_model=Dict[str, Any])
async def get_market_intelligence(
    city: Optional[str] = None,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Fetches city-level market intelligence for the admin Intelligence tab.

    EXPLANATION: Corrected Route Handler
    Previously this called get_admin_stats_logic(db) which returns AdminStats
    (total_users, total_hotels, etc.), but the frontend AnalyticsPanel expects
    { hotels: [...], summary: { hotel_count, avg_price, price_range, scan_coverage_pct } }.
    Now correctly calls get_admin_market_intelligence_logic with city filter.
    """
    return await get_admin_market_intelligence_logic(db, city)


@router.get("/scheduler/queue", response_model=List[SchedulerQueueEntry])
async def get_scheduler_queue(
    db: Client = Depends(get_supabase_admin), admin=Depends(get_current_admin_user)
):
    """
    Returns the list of users with scheduled scans for the admin Upcoming Queue tab.

    EXPLANATION: Missing Endpoint Implementation
    The ScansPanel frontend component calls /api/admin/scheduler/queue but this
    route was never created. Without it, the queue silently failed and always
    showed 'No scheduled scans found'.
    """
    return await get_scheduler_queue_logic(db)


@router.post("/scheduler/trigger-all", response_model=SuccessResponse)
async def trigger_all_overdue(admin=Depends(get_current_admin_user)):
    """
    Manually triggers all overdue/due scans at once.
    Wakes up the background scheduler pipeline.
    """
    return await trigger_all_overdue_logic()


@router.delete("/scans/cleanup-empty", response_model=SuccessResponse)
async def cleanup_empty_scans(
    admin=Depends(get_current_admin_user), db: Client = Depends(get_supabase_admin)
):
    """
    Administrative cleanup: Removes scans that failed or have no results.
    """
    return await cleanup_empty_scans_logic(db)


@router.get("/batches", response_model=List[Dict[str, Any]])
async def get_admin_batches(
    limit: int = 50,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Lists live extraction batches for monitoring system load.
    """
    return await get_admin_batches_logic(db, limit)


@router.get("/batches/{batch_id}", response_model=Dict[str, Any])
async def get_admin_batch_details(
    batch_id: str,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Fetches fine-grained task data for a specific extraction batch.
    Used for diagnosing specific scraping failures.
    """
    return await get_admin_batch_details_logic(db, batch_id)


@router.post("/tasks/{task_id}/rescan", response_model=SuccessResponse)
async def rescan_batch_task(
    task_id: str,
    db: Client = Depends(get_supabase_admin),
    admin=Depends(get_current_admin_user),
):
    """
    Manually retries a failed extraction task by resetting its state.
    """
    return await rescan_batch_task_logic(db, task_id)


@router.post("/terminate-impersonation", response_model=SuccessResponse)
async def terminate_impersonation(admin=Depends(get_current_admin_user)):
    """
    Terminates the impersonation session.
    This is a stateless operation on the backend; the client-side terminates
    impersonation by removing the headers/query parameters.
    """
    return {"status": "success", "message": "Impersonation session terminated successfully."}
