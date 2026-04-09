import time
from datetime import datetime, timezone
from typing import Dict, Any
from supabase import Client

class RetentionService:
    """
    Service for managing data retention and historical rollups.
    Optimized for native PostgreSQL execution (backend-heavy).
    """

    @staticmethod
    async def run_maintenance_cycle(db: Client, dry_run: bool = False) -> Dict[str, Any]:
        """
        Runs the maintenance cycle using a native database function for efficiency.
        This handles millions of rows without timing out Vercel.
        """
        start_time = time.time()
        stats = {
            "task": "Full Maintenance Cycle (Native SQL)",
            "errors": [],
            "rollups": 0,
            "logs_pruned": 0
        }

        try:
            if dry_run:
                print("[DRY RUN] Would execute native SQL maintenance function.")
                return stats

            # Call the optimized SQL function created in the DB
            # This shifts aggregation and pruning entirely to the database engine
            response = db.rpc("perform_data_maintenance").execute()
            
            if response.data:
                stats["rollups"] = response.data.get("rolled_up", 0)
                stats["logs_pruned"] = response.data.get("pruned_logs", 0)
                status = response.data.get("status", "SUCCESS")
            else:
                status = "SUCCESS"

        except Exception as e:
            status = "FAILED"
            stats["errors"].append(str(e))
            print(f"MAIN_CRON_ERROR: {str(e)}")

        # Log completion to maintenance_logs
        duration_ms = int((time.time() - start_time) * 1000)
        try:
            db.table("maintenance_logs").insert({
                "task_name": "retention_policy_execution",
                "status": status,
                "rows_processed": stats["rollups"],
                "rows_deleted": stats["logs_pruned"],
                "duration_ms": duration_ms,
                "details": stats
            }).execute()
        except:
            pass # Avoid crashing main cron if logging fails

        return stats
