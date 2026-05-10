"""
Admin Services Package
======================
Re-exports all admin service functions from their modular sub-modules.

Module Map:
  user_admin.py         — User CRUD, roles, quotas
  hotel_admin.py        — Hotel/directory management
  scan_admin.py         — Scan sessions, batches, logs, feed
  system_stats.py       — Stats, health, heartbeats, scheduler, settings
  plan_admin.py         — Membership plan CRUD
  sync_admin.py         — Directory/profile sync, conflict resolution, cleanup
  market_intelligence.py — Market analytics, trends, competitor matrix
"""

# User Management
from backend.services.admin.user_admin import (
    get_admin_users_logic,
    admin_update_user_logic,
    create_admin_user_logic,
    delete_admin_user_logic,
)

# Hotel & Directory Management
from backend.services.admin.hotel_admin import (
    search_admin_directory_logic,
    get_admin_directory_logic,
    add_admin_directory_entry_logic,
    delete_admin_directory_logic,
    update_admin_directory_logic,
    get_admin_hotels_logic,
    update_admin_hotel_logic,
    delete_admin_hotel_logic,
)

# Scan Sessions, Batches & Logs
from backend.services.admin.scan_admin import (
    get_admin_scans_logic,
    get_admin_scan_details_logic,
    get_admin_scan_export_logic,
    get_admin_logs_logic,
    get_admin_feed_logic,
    cleanup_empty_scans_logic,
    get_admin_batches_logic,
    get_admin_batch_details_logic,
    rescan_batch_task_logic,
)

# System Stats, Health & Settings
from backend.services.admin.system_stats import (
    get_admin_stats_logic,
    get_admin_providers_logic,
    get_system_logs_logic,
    get_admin_market_heartbeats_logic,
    get_scheduler_queue_logic,
    trigger_all_overdue_logic,
    get_admin_settings_logic,
    update_admin_settings_logic,
)

# Membership Plans
from backend.services.admin.plan_admin import (
    get_admin_plans_logic,
    create_admin_plan_logic,
    update_admin_plan_logic,
    delete_admin_plan_logic,
    delete_plan_logic,
)

# Sync, Conflict Resolution & Cleanup
from backend.services.admin.sync_admin import (
    get_sync_status_logic,
    trigger_sync_logic,
    get_sync_history_logic,
    resolve_sync_conflict_logic,
    get_directory_profiles_logic,
    sync_hotel_directory_logic,
    sync_user_profiles_logic,
    sync_all_logic,
    cleanup_test_data_logic,
)

# Market Intelligence
from backend.services.admin.market_intelligence import (
    get_market_overview_logic,
    get_price_trends_logic,
    get_competitor_matrix_logic,
    get_alert_summary_logic,
)

__all__ = [
    # User
    "get_admin_users_logic",
    "admin_update_user_logic",
    "create_admin_user_logic",
    "delete_admin_user_logic",
    # Hotel & Directory
    "search_admin_directory_logic",
    "get_admin_directory_logic",
    "add_admin_directory_entry_logic",
    "delete_admin_directory_logic",
    "update_admin_directory_logic",
    "get_admin_hotels_logic",
    "update_admin_hotel_logic",
    "delete_admin_hotel_logic",
    # Scans
    "get_admin_scans_logic",
    "get_admin_scan_details_logic",
    "get_admin_scan_export_logic",
    "get_admin_logs_logic",
    "get_admin_feed_logic",
    "cleanup_empty_scans_logic",
    "get_admin_batches_logic",
    "get_admin_batch_details_logic",
    "rescan_batch_task_logic",
    # System
    "get_admin_stats_logic",
    "get_admin_providers_logic",
    "get_system_logs_logic",
    "get_admin_market_heartbeats_logic",
    "get_scheduler_queue_logic",
    "trigger_all_overdue_logic",
    "get_admin_settings_logic",
    "update_admin_settings_logic",
    # Plans
    "get_admin_plans_logic",
    "create_admin_plan_logic",
    "update_admin_plan_logic",
    "delete_admin_plan_logic",
    "delete_plan_logic",
    # Sync
    "get_sync_status_logic",
    "trigger_sync_logic",
    "get_sync_history_logic",
    "resolve_sync_conflict_logic",
    "get_directory_profiles_logic",
    "sync_hotel_directory_logic",
    "sync_user_profiles_logic",
    "sync_all_logic",
    "cleanup_test_data_logic",
    # Market Intelligence
    "get_market_overview_logic",
    "get_price_trends_logic",
    "get_competitor_matrix_logic",
    "get_alert_summary_logic",
]
