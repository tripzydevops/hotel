import asyncio
from uuid import UUID
from typing import List, Optional, Dict, Any
from backend.celery_app import celery_app
from backend.utils.db import get_supabase
from backend.agents.scraper_agent import ScraperAgent
from backend.agents.analyst_agent import AnalystAgent
from backend.agents.notifier_agent import NotifierAgent
from backend.models.schemas import ScanOptions
from backend.utils.logger import get_logger

logger = get_logger(__name__)

@celery_app.task(bind=True, name="backend.tasks.run_scan_task")
def run_scan_task(self, user_id: str, hotels: List[Dict], options_dict: Optional[Dict], session_id: Optional[str]):
    """
    Celery task wrapper for the asynchronous ScraperAgent.
    Since Celery is synchronous by default, we use asyncio.run to execute the async agents.
    """
    logger.info(f"[Worker] Received scan task for user {user_id} with {len(hotels)} hotels.")
    
    async def _async_wrapper():
        db = get_supabase()
        scraper = ScraperAgent(db)
        analyst = AnalystAgent(db)
        notifier = NotifierAgent()
        
        # Reconstruct Options object
        options = ScanOptions(**options_dict) if options_dict else None
        
        # 1. Scraper
        logger.info("[Worker] Starting ScraperAgent...")
        scraper_results = await scraper.run_scan(
            user_id=UUID(user_id), 
            hotels=hotels, 
            options=options, 
            session_id=UUID(session_id) if session_id else None
        )
        
        # 2. Analyst
        # Get threshold (logic duplicated from monitor_service for now, or fetch fresh)
        threshold = 2.0 
        settings_res = db.table("settings").select("threshold_percent").eq("user_id", user_id).execute()
        if settings_res.data:
            threshold = settings_res.data[0].get("threshold_percent", 2.0)
            
        logger.info("[Worker] Starting AnalystAgent...")
        analysis = await analyst.analyze_results(
            user_id=UUID(user_id), 
            results=scraper_results, 
            threshold=threshold, 
            options=options, 
            session_id=UUID(session_id) if session_id else None
        )
        
        # 3. Notifier
        if analysis.get("alerts"):
            settings_res = db.table("settings").select("*").eq("user_id", str(user_id)).execute()
            settings = settings_res.data[0] if settings_res.data else None
            if settings:
                hotel_name_map = {h["id"]: h["name"] for h in hotels}
                await notifier.dispatch_alerts(analysis["alerts"], settings, hotel_name_map)
        
        # 4. Finalize
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"
            
        if session_id:
            db.table("scan_sessions").update({
                "status": final_status,
                "completed_at": datetime.now().isoformat() # We need datetime imported
            }).eq("id", str(session_id)).execute()
            
        return analysis

    from datetime import datetime
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_async_wrapper())
        loop.close()
        return result
    except Exception as e:
        logger.error(f"[Worker] Task failed: {e}")
        # Mark session as failed
        if session_id:
            db = get_supabase()
            db.table("scan_sessions").update({
                "status": "failed", 
                "error": str(e)
            }).eq("id", str(session_id)).execute()
        raise e
