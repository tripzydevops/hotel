"""
Admin — Scan Session Management
=================================
Handles scan session listing, details, CSV export, batch monitoring,
and task recovery.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

import io
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

import pandas as pd
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.models.schemas import AdminLog
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_admin_scans_logic(db: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """List recent scan sessions."""
    sessions = cast(List[Dict[str, Any]], (
        db.table("scan_sessions")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    ))
    user_ids = list(set(s["user_id"] for s in sessions))
    profiles = (
        db.table("user_profiles")
        .select("user_id, display_name")
        .in_("user_id", user_ids)
        .execute()
    )
    users_map = {
        p["user_id"]: p.get("display_name", "Unknown") for p in cast(List[Dict[str, Any]], profiles.data or [])
    }

    results = []
    for s in sessions:
        results.append(
            {
                "id": s["id"],
                "user_id": s["user_id"],
                "user_name": users_map.get(s["user_id"], "Unknown"),
                "session_type": s["session_type"],
                "status": s["status"],
                "hotels_count": s["hotels_count"],
                "created_at": s["created_at"],
                "completed_at": s["completed_at"],
                "has_payload": s.get("raw_payload") is not None,
            }
        )
    return results


async def get_admin_scan_details_logic(scan_id: UUID, db: Client) -> Dict[str, Any]:
    """Fetch detailed logs, tasks, and results for a specific scan."""
    try:
        session = cast(Dict[str, Any], (
            db.table("scan_sessions")
            .select("*")
            .eq("id", str(scan_id))
            .single()
            .execute()
            .data
        ))
        if not session:
            raise HTTPException(404, "Scan session not found")

        # Get extraction results
        logs = cast(List[Dict[str, Any]], (
            db.table("query_logs")
            .select("*")
            .eq("session_id", str(scan_id))
            .execute()
            .data
            or []
        ))

        # KAİZEN 2026: Fetch individual task progress
        # This provides visibility into pending/failed tasks that haven't produced logs yet.
        batches = cast(List[Dict[str, Any]], (
            db.table("scan_batches")
            .select("id")
            .eq("session_id", str(scan_id))
            .execute()
            .data
            or []
        ))
        
        batch_ids = [b["id"] for b in batches]
        tasks: List[Dict[str, Any]] = []
        if batch_ids:
            tasks = cast(List[Dict[str, Any]], (
                db.table("scan_tasks")
                .select("*, hotels(name)")
                .in_("batch_id", batch_ids)
                .execute()
                .data
                or []
            ))

        return {
            "session": session, 
            "logs": logs,
            "tasks": tasks
        }
    except HTTPException:
        raise
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching scan details for {scan_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Database error: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data error in scan details for {scan_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Data processing error: {e}")


async def get_admin_scan_export_logic(scan_id: UUID, db: Client) -> StreamingResponse:
    """
    KAIZEN: The Extraction Vault Export (Phase 1.2)
    Optimized for high-performance streaming and deep payload traversal.
    Specifically targets DataForSEO nested arrays and handles large datasets
    without causing OOM by yielding CSV chunks.
    """
    try:
        res = (
            db.table("scan_sessions")
            .select("raw_payload")
            .eq("id", str(scan_id))
            .single()
            .execute()
        )

        session_data = cast(Dict[str, Any], res.data or {})
        if not session_data or not session_data.get("raw_payload"):
            raise HTTPException(404, "No raw payload found in the extraction vault.")

        payload = session_data["raw_payload"]

        # EXPLANATION: Deep Payload Navigation
        # DataForSEO results are often nested in tasks[0].result[0].items.
        # We attempt to find this specific path first.
        target_items = None
        if isinstance(payload, dict):
            # Check for DataForSEO structure
            try:
                tasks = payload.get("tasks", [])
                if tasks and isinstance(tasks, list):
                    results = tasks[0].get("result", [])
                    if results and isinstance(results, list):
                        items = results[0].get("items", [])
                        if isinstance(items, list) and items:
                            target_items = items
            except (IndexError, KeyError, TypeError):
                pass
            
            # Fallback to search for any large list if DataForSEO path failed
            if not target_items:
                results_key = None
                for key, value in payload.items():
                    if isinstance(value, list) and (
                        not results_key or len(value) > len(payload[results_key])
                    ):
                        results_key = key
                if results_key:
                    target_items = payload[results_key]

        elif isinstance(payload, list):
            target_items = payload

        if not target_items:
            # If still nothing, just normalize the whole payload if it exists
            target_items = payload if payload else []

        # Normalize the JSON payload into a flat table
        # NOTE: We keep the dataframe in memory, but stream the serialization phase.
        try:
            df = pd.json_normalize(target_items)
        except (ValueError, TypeError) as e:
            logger.warning(f"Normalization failed, falling back to DataFrame: {e}")
            df = pd.DataFrame(target_items)

        if df.empty:
            raise HTTPException(400, "Extraction payload resulted in an empty dataset.")

        # EXPLANATION: True Chunked Streaming
        # We use a generator to yield CSV chunks. This prevents the server from
        # building a massive string/BytesIO object in memory for large exports.
        async def csv_generator():
            output = io.StringIO()
            # Write headers first
            df.head(0).to_csv(output, index=False)
            yield output.getvalue().encode("utf-8")
            output.truncate(0)
            output.seek(0)

            chunk_size = 500  # Process 500 rows at a time
            for i in range(0, len(df), chunk_size):
                chunk = df.iloc[i : i + chunk_size]
                chunk.to_csv(output, index=False, header=False)
                yield output.getvalue().encode("utf-8")
                output.truncate(0)
                output.seek(0)

        return StreamingResponse(
            csv_generator(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=scan_{scan_id}.csv",
                "X-Export-Rows": str(len(df)),
            },
        )

    except HTTPException:
        raise
    except PostgRESTError as e:
        logger.error(f"PostgREST error exporting scan {scan_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Database error during export: {e}")
    except (ValueError, TypeError, KeyError) as e:
        logger.error(f"Data processing error exporting scan {scan_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Export data error: {e}")


async def get_admin_logs_logic(db: Client, limit: int = 50) -> List[AdminLog]:
    """
    Fetch recent system activity logs.
    """
    try:
        result = (
            db.table("scan_sessions")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        logs = []
        for session in cast(List[Dict[str, Any]], result.data or []):
            level = "INFO"
            if session["status"] == "failed":
                level = "ERROR"
            elif session["status"] == "completed":
                level = "SUCCESS"

            logs.append(
                AdminLog(
                    id=session["id"],
                    timestamp=session["created_at"],
                    level=level,
                    action=f"Scan Session ({session['session_type']})",
                    details=f"Checked {session.get('hotels_count', 0)} hotels",
                    user_id=session["user_id"],
                )
            )
        return logs
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching admin logs: {e}", exc_info=True)
        return []
    except (KeyError, TypeError) as e:
        logger.warning(f"Data error processing admin logs: {e}")
        return []


async def get_admin_feed_logic(
    limit: int = 50, db: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """Get live agent feed logs."""
    try:
        if db is None:
            logger.warning("Agent feed error: db client is None")
            return []
        logs_res = (
            db.table("query_logs")
            .select("id, hotel_name, action_type, status, created_at, price, currency")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return cast(List[Dict[str, Any]], logs_res.data or [])
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching agent feed: {e}", exc_info=True)
        return []
    except AttributeError as e:
        logger.warning(f"Agent feed error (db client may be None): {e}")
        return []


async def cleanup_empty_scans_logic(db: Client) -> Dict[str, Any]:
    """
    Identifies and removes scan sessions that have no results.
    Criteria:
    - raw_payload is NULL
    """
    try:
        # KAIZEN: Simplified to a single-line batch deletion per exact requirement.
        # This removes all sessions where no DataForSEO payload was ever saved.
        response = db.table("scan_sessions").delete().is_("raw_payload", "null").execute()
        
        # In PostgREST, delete returns the deleted rows if 'return=representation' is handled by the client.
        # If not, data might be empty. We check if response.data is available.
        deleted_count = len(cast(List[Any], response.data)) if hasattr(response, 'data') and response.data else 0
        
        return {
            "status": "success",
            "count": deleted_count,
            "message": f"Successfully removed {deleted_count} empty scan sessions."
        }
    except PostgRESTError as e:
        logger.error(f"PostgREST error cleaning up empty scans: {e}", exc_info=True)
        return {"status": "error", "error": f"Database error: {e}"}


async def get_admin_batches_logic(db: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch live extraction batches for monitoring.
    Includes success/failure counts and progress percentage.
    """
    try:
        # EXPLANATION: Batch Monitoring
        # Providing visibility into individual 'Live Extraction' clusters.
        # This helps admins track the throughput of their scraper nodes.
        res = (
            db.table("scan_batches")
            .select("*, hotels(name)")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        batches = cast(List[Dict[str, Any]], res.data or [])
        for b in batches:
            total = b.get("total_tasks") or 0
            success = b.get("success_count") or 0
            failed = b.get("failure_count") or 0

            if total > 0:
                b["progress"] = round(((success + failed) / total) * 100, 1)
            else:
                b["progress"] = 0

        return batches
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching batches: {e}", exc_info=True)
        return []
    except (KeyError, TypeError) as e:
        logger.warning(f"Data error processing batches: {e}")
        return []


async def get_admin_batch_details_logic(db: Client, batch_id: str) -> Dict[str, Any]:
    """
    Fetch all tasks associated with a specific batch.
    Includes deep details for diagnostics.
    """
    try:
        # 1. Get batch metadata
        batch_res = (
            db.table("scan_batches")
            .select("*, hotels(name)")
            .eq("id", batch_id)
            .single()
            .execute()
        )
        batch = cast(Dict[str, Any], batch_res.data)

        # 2. Get tasks
        tasks_res = (
            db.table("scan_tasks")
            .select("*, hotels(name)")
            .eq("batch_id", batch_id)
            .order("created_at", desc=False)
            .execute()
        )

        return {"batch": batch, "tasks": cast(List[Dict[str, Any]], tasks_res.data or [])}
    except PostgRESTError as e:
        logger.error(f"PostgREST error fetching batch details for {batch_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except (KeyError, TypeError) as e:
        logger.warning(f"Data error in batch details for {batch_id}: {e}")
        return {"error": f"Data processing error: {e}"}


async def rescan_batch_task_logic(db: Client, task_id: str) -> Dict[str, Any]:
    """
    Resets a failed task to 'pending' to trigger a retry.
    Useful for manual recovery of failed individual extraction tasks.
    """
    try:
        # EXPLANATION: Granular Task Recovery
        # Resets individual task states to allow the monitor service
        # to pick them up again in the next extraction cycle.
        db.table("scan_tasks").update(
            {
                "status": "pending",
                "error_message": None,
                "started_at": None,
                "completed_at": None,
            }
        ).eq("id", task_id).execute()

        return {"status": "success", "message": "Task reset to pending for retry."}
    except PostgRESTError as e:
        logger.error(f"PostgREST error resetting task {task_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
