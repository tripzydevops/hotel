import time
from typing import Any, Dict

from supabase import Client


class RetentionService:
    """
    Service for managing data retention and historical rollups.
    Optimized for native PostgreSQL execution (backend-heavy).
    """

    @staticmethod
    async def run_maintenance_cycle(
        db: Client, dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Runs the maintenance cycle using a native database function for efficiency.
        This handles millions of rows without timing out Vercel.
        """
        start_time = time.time()
        stats = {
            "task": "Full Maintenance Cycle (Native SQL)",
            "errors": [],
            "rollups": 0,
            "logs_pruned": 0,
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
                if status == "FAILED":
                    stats["errors"].append(response.data.get("error", "Unknown SQL Error"))
            else:
                status = "SUCCESS"

        except Exception as e:
            status = "FAILED"
            stats["errors"].append(str(e))
            print(f"MAIN_CRON_ERROR: {str(e)}")

        # Log completion to maintenance_logs
        duration_ms = int((time.time() - start_time) * 1000)
        try:
            db.table("maintenance_logs").insert(
                {
                    "task_name": "retention_policy_execution",
                    "status": status,
                    "rows_processed": stats["rollups"],
                    "rows_deleted": stats["logs_pruned"],
                    "duration_ms": duration_ms,
                    "details": stats,
                }
            ).execute()
        except Exception:
            pass  # Avoid crashing main cron if logging fails

        return stats

    @staticmethod
    async def trigger_daily_rollup(
        db: Client, hotel_ids: list = None
    ) -> Dict[str, Any]:
        """
        Force-refresh today's rollup for specific hotels or all.
        Useful for on-demand data freshness and testing.
        
        This does NOT prune raw logs — it only aggregates into price_history_daily.
        """
        start_time = time.time()
        stats = {"task": "On-Demand Daily Rollup", "errors": [], "rollups": 0}

        try:
            if hotel_ids:
                # Targeted rollup for specific hotels
                for hid in hotel_ids:
                    try:
                        # Aggregate today's price_logs for this hotel
                        logs_res = (
                            db.table("price_logs")
                            .select("hotel_id, price, check_in_date, recorded_at, vendor, room_types")
                            .eq("hotel_id", hid)
                            .execute()
                        )
                        logs = logs_res.data or []
                        if not logs:
                            continue

                        # Group by (check_in_date, observation_date)
                        from collections import defaultdict
                        groups = defaultdict(list)
                        for log in logs:
                            key = (
                                log.get("check_in_date"),
                                str(log.get("recorded_at", ""))[:10],  # observation_date
                            )
                            groups[key].append(log)

                        for (check_in, obs_date), group_logs in groups.items():
                            if not check_in or not obs_date:
                                continue
                            prices = [float(l.get("price", 0)) for l in group_logs if l.get("price")]
                            if not prices:
                                continue

                            db.table("price_history_daily").upsert(
                                {
                                    "hotel_id": hid,
                                    "date": check_in,
                                    "observation_date": obs_date,
                                    "avg_price": sum(prices) / len(prices),
                                    "min_price": min(prices),
                                    "max_price": max(prices),
                                    "source": "on_demand_rollup",
                                    "top_vendor": group_logs[-1].get("vendor"),
                                },
                                on_conflict="hotel_id,date,observation_date",
                            ).execute()
                            stats["rollups"] += 1
                    except Exception as e:
                        stats["errors"].append(f"{hid}: {str(e)}")
            else:
                # Full rollup via native SQL function
                response = db.rpc("perform_data_maintenance").execute()
                if response.data:
                    stats["rollups"] = response.data.get("rolled_up", 0)

        except Exception as e:
            stats["errors"].append(str(e))

        stats["duration_ms"] = int((time.time() - start_time) * 1000)
        return stats

