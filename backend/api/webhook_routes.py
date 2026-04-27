import logging

from fastapi import APIRouter, Depends, Request

from backend.services.monitor_service import sync_extraction_result
from backend.services.providers.dataforseo_provider import dataforseo_provider
from backend.utils.db import get_supabase_client
from supabase import Client

router = APIRouter(prefix="/webhooks/dataforseo", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/task-completed")
async def handle_task_completed(
    request: Request, db: Client = Depends(get_supabase_client)
):
    """
    Webhook handler for DataForSEO task completion notifications.
    Standardized to handle Kaizen scan tasks and legacy pulse tasks.
    """
    try:
        # 1. Parse payload
        # DataForSEO typically sends task_id and other metadata in a POST body
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
        # Pass DB for identity resolution
        processed, raw = await dataforseo_provider.fetch_task_results(task_id, db=db)
        
        if not processed or processed.get("status") != "success":
            logger.warning(f"Webhook: Result fetch failed or identity mismatch for {task_id}")
            return {"status": "error", "reason": "fetch_failed_or_identity_mismatch"}

        result = processed

        # 3. Process the results using the core sync utility
        # Tag identifies the hotel/task context
        tag_raw = result.get("tag", "")
        scan_task_id = None
        h_id = None
        batch_id = None

        if "|" in tag_raw:
            try:
                # Legacy format: session_id|hotel_id
                _, h_id = tag_raw.split("|", 1)
            except Exception:
                h_id = tag_raw
        else:
            # Kaizen format: scan_task_id
            scan_task_id = tag_raw

        # 4. Resolve metadata from DB if we have a scan_task_id
        if scan_task_id:
            task_res = (
                db.table("scan_tasks").select("*").eq("id", scan_task_id).execute()
            )
            if task_res.data:
                scan_task = task_res.data[0]
                h_id = scan_task["hotel_id"]
                batch_id = scan_task["batch_id"]

                if scan_task["status"] == "completed":
                    logger.info(
                        f"Webhook: Task {scan_task_id} already marked completed. Skipping."
                    )
                    return {"status": "success", "detail": "already_processed"}

        if not h_id:
            logger.warning(f"Webhook: Could not resolve hotel_id from tag: {tag_raw}")
            return {"status": "ignored", "reason": "unresolved_hotel"}

        # 5. Execute unified sync
        success = await sync_extraction_result(
            insforge=db,
            hotel_id=h_id,
            result=result,
            session_id=scan_task_id,
            source="Webhook",
        )

        if success:
            return {"status": "success"}
        else:
            return {"status": "error", "reason": "sync_failed"}

    except Exception as e:
        logger.error(f"Webhook Processing Error: {e}")
        return {"status": "error", "detail": str(e)}
