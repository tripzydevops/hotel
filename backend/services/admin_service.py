"""
admin_service.py — DEPRECATED Compatibility Shim
=================================================
All logic has been migrated to modular sub-modules:

  backend.services.admin.*          — Admin-only operations
  backend.services.report_service   — User-scoped reporting

This file re-exports symbols for any legacy code that may still
import from `backend.services.admin_service`. It will be removed
in a future release once all consumers are confirmed migrated.

DO NOT add new logic here.
"""

import warnings

warnings.warn(
    "backend.services.admin_service is deprecated. "
    "Import from backend.services.admin or backend.services.report_service instead.",
    DeprecationWarning,
    stacklevel=2,
)

# ──────────────────────────────────────────────────────────────
# Re-exports from the modular admin package
# ──────────────────────────────────────────────────────────────
from backend.services.admin import (  # noqa: F401, E402
    # User Management
    get_admin_users_logic,
    admin_update_user_logic,
    create_admin_user_logic,
    delete_admin_user_logic,
    # Hotel & Directory
    search_admin_directory_logic,
    get_admin_directory_logic,
    add_admin_directory_entry_logic,
    delete_admin_directory_logic,
    update_admin_directory_logic,
    get_admin_hotels_logic,
    update_admin_hotel_logic,
    delete_admin_hotel_logic,
    # Scans
    get_admin_scans_logic,
    get_admin_scan_details_logic,
    get_admin_scan_export_logic,
    get_admin_logs_logic,
    get_admin_feed_logic,
    cleanup_empty_scans_logic,
    get_admin_batches_logic,
    get_admin_batch_details_logic,
    rescan_batch_task_logic,
    # System
    get_admin_stats_logic,
    get_admin_providers_logic,
    get_system_logs_logic,
    get_admin_market_heartbeats_logic,
    get_scheduler_queue_logic,
    trigger_all_overdue_logic,
    get_admin_settings_logic,
    update_admin_settings_logic,
    # Plans
    get_admin_plans_logic,
    create_admin_plan_logic,
    update_admin_plan_logic,
    delete_admin_plan_logic,
    delete_plan_logic,
    # Sync
    get_sync_status_logic,
    trigger_sync_logic,
    get_sync_history_logic,
    resolve_sync_conflict_logic,
    get_directory_profiles_logic,
    sync_hotel_directory_logic,
    sync_user_profiles_logic,
    sync_all_logic,
    cleanup_test_data_logic,
    # Market Intelligence
    get_market_overview_logic,
    get_price_trends_logic,
    get_competitor_matrix_logic,
    get_alert_summary_logic,
    get_admin_market_intelligence_logic,
)

# ──────────────────────────────────────────────────────────────
# Re-exports from the report service
# ──────────────────────────────────────────────────────────────
from backend.services.report_service import (  # noqa: F401, E402
    get_reports_logic,
    export_report_logic,
)
