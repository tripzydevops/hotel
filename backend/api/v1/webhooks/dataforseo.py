import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Request
from supabase import Client

from backend.services.monitor_service import sync_extraction_result
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.utils.db import get_supabase_client

router = APIRouter(prefix="/v1/webhooks/dataforseo", tags=["webhooks"])
logger = logging.getLogger(__name__)

@router.post("")
@router.post("/")
@router.post("/task-completed")
async def handle_dataforseo_webhook(
    request: Request, db: Client = Depends(get_supabase_client)
):
    """
    Unified Webhook handler for DataForSEO notifications.
    Standardized to handle Price Search and Hotel Info tasks.
    Supports legacy pulse tags and modern scan_task_id resolution.
    """
    try:
        # 1. Parse payload
        payload = await request.json()
        logger.info(f"Received DataForSEO Webhook: {payload}")

        # DataForSEO format: result[0].id or similar depending on the specific hook
        # Usually it reflects the posted task structure
        task_id = payload.get("id")
        if not task_id and payload.get("results"):
            task_id = payload["results"][0].get("id")

        if not task_id:
            logger.warning("Webhook received with no task ID")
            return {"status": "ignored", "reason": "no_task_id"}

        # 2. Fetch full results from provider
        # Try price search first
        processed, raw = await dataforseo_provider.fetch_task_results(task_id, db=db)
        
        # If price search failed or returned nothing, try info results
        if not processed or processed.get("status") != "success":
            logger.info(f"Webhook: Result not found for hotel_searches {task_id}. Trying hotel_info...")
            processed, raw = await dataforseo_provider.fetch_hotel_info_results(task_id, db=db)

        if not processed or processed.get("status") != "success":
            logger.warning(f"Webhook: Result fetch failed or identity mismatch for {task_id}")
            return {"status": "error", "reason": "fetch_failed_or_identity_mismatch"}

        # 3. Resolve metadata from DB
        tag_raw = str(processed.get("tag", ""))
        scan_task_id = None
        h_id = None
        user_id = None

        if "|" in tag_raw:
            try:
                # Legacy format: session_id|hotel_id
                parts = tag_raw.split("|")
                if len(parts) >= 2:
                    h_id = parts[1]
                scan_task_id = parts[0]
            except Exception:
                h_id = tag_raw
        else:
            # Kaizen format: scan_task_id (UUID)
            scan_task_id = tag_raw

        # 4. Deep resolution from DB if we have a scan_task_id
        if scan_task_id:
            try:
                task_res = (
                    db.table("scan_tasks").select("*").eq("id", scan_task_id).execute()
                )
                if task_res.data:
                    scan_task = task_res.data[0]
                    h_id = h_id or scan_task.get("hotel_id")
                    user_id = scan_task.get("initiator_id")

                    if scan_task.get("status") == "completed":
                        logger.info(
                            f"Webhook: Task {scan_task_id} already marked completed. Skipping sync."
                        )
                        return {"status": "success", "detail": "already_processed"}
            except Exception as db_e:
                logger.error(f"Webhook: DB resolution error for tag {tag_raw}: {db_e}")

        if not h_id:
            logger.warning(f"Webhook: Could not resolve hotel_id from tag: {tag_raw}")
            return {"status": "ignored", "reason": "unresolved_hotel"}

        # 5. Execute unified sync
        success = await sync_extraction_result(
            insforge=db,
            hotel_id=h_id,
            result=processed,
            user_id=user_id,
            session_id=scan_task_id,
            source="DataForSEO Webhook",
        )

        if success:
            return {"status": "success", "task_id": task_id}
        else:
            return {"status": "error", "reason": "sync_failed"}

    except Exception as e:
        logger.error(f"Webhook Processing Error: {e}")
        return {"status": "error", "detail": str(e)}
