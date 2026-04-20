from fastapi import APIRouter, BackgroundTasks, Request

from backend.services.monitor_service import process_system_scans
from backend.utils.db import get_supabase_client
from backend.utils.logger import get_logger

# Initialize router without prefix here, prefix will be added in main.app
router = APIRouter(tags=["webhooks"])
logger = get_logger(__name__)


@router.post("/hotel-webhook")
async def hotel_webhook_handler(request: Request, background_tasks: BackgroundTasks):
    """
    DataForSEO Pingback handler.
    When a task is ready, DataForSEO sends a POST with the task ID.
    """
    try:
        payload = await request.json()
        task_id = payload.get("id")

        logger.info(f"Received DataForSEO pingback for task: {task_id}")

        # We trigger process_system_scans in the background to ensure fast response to DataForSEO
        # If no task_id is present, it will still attempt to sync all pending tasks (safety net)
        db = get_supabase_client(admin=True)
        background_tasks.add_task(process_system_scans, db)

        return {"status": "success", "message": "Ingestion triggered"}

    except Exception as e:
        logger.error(f"Hotel webhook error: {str(e)}")
        # Return 200 even on error to stop DataForSEO retries if we've logged it
        return {"status": "error", "message": str(e)}
