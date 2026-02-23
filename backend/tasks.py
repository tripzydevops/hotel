import asyncio
from uuid import UUID
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.celery_app import celery_app
from backend.utils.db import get_supabase
# from backend.agents.scraper_agent import ScraperAgent
# from backend.agents.analyst_agent import AnalystAgent
# from backend.agents.notifier_agent import NotifierAgent
from backend.models.schemas import ScanOptions
from backend.utils.logger import get_logger

logger = get_logger(__name__)

@celery_app.task(bind=True, name="backend.tasks.run_scan_task")
def run_scan_task(self, user_id: str, hotels: List[Dict], options_dict: Optional[Dict], session_id: Optional[str]):
    """
    Celery task wrapper for the asynchronous ScraperAgent.
    Since Celery is synchronous by default, we use asyncio.run to execute the async agents.
    """
    logger.info(f"[Worker] Received scan task for user {user_id} with {len(hotels)} hotels. Session: {session_id}")
    
    # PROACTIVE: Immediate Feedback
    if session_id:
        try:
            db = get_supabase()
            current_trace = db.table("scan_sessions").select("reasoning_trace").eq("id", str(session_id)).execute().data[0]["reasoning_trace"]
            db.table("scan_sessions").update({
                "status": "running",
                "reasoning_trace": current_trace + [f"Worker {self.request.id[:8]} started processing..."]
            }).eq("id", str(session_id)).execute()
        except Exception as e:
            logger.warning(f"Failed to log worker receipt: {e}")

    async def _async_wrapper():
        # Lazy Loading for AI Agents to support slim Vercel deployments
        from backend.agents.scraper_agent import ScraperAgent
        from backend.agents.analyst_agent import AnalystAgent
        from backend.agents.notifier_agent import NotifierAgent

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
            scraper_results=scraper_results, 
            threshold=threshold, 
            options=options, 
            session_id=UUID(session_id) if session_id else None
        )
        
        # 3. Notifier
        # EXPLANATION: Previously referenced undefined 'settings' variable, causing
        # silent crash. Now we properly fetch settings before dispatching alerts.
        if analysis.get("alerts"):
            logger.info(f"[Worker] Dispatching {len(analysis['alerts'])} alerts...")
            try:
                settings_res = db.table("settings").select("*").eq("user_id", user_id).execute()
                settings = settings_res.data[0] if settings_res.data else None
            except Exception:
                settings = None
            if settings:
                hotel_name_map = {h["id"]: h["name"] for h in hotels}
                await notifier.dispatch_alerts(
                    alerts=analysis.get("alerts", []), 
                    settings=settings, 
                    hotel_name_map=hotel_name_map,
                    session_id=session_id
                )
        
        # 4. Finalize
        final_status = "completed"
        if any(res.get("status") != "success" for res in scraper_results):
            final_status = "partial"
            
        if session_id:
            logger.info(f"[Worker] Finalizing session {session_id} with status: {final_status}")
            try:
                # Use a fresh fetch to ensure we don't overwrite concurrent agent logs
                # In a real app we'd use JSONB append, here we do best effort
                latest_res = db.table("scan_sessions").select("reasoning_trace").eq("id", str(session_id)).execute()
                trace = latest_res.data[0]["reasoning_trace"] if latest_res.data else []
                
                db.table("scan_sessions").update({
                    "status": final_status,
                    "completed_at": datetime.now().isoformat(),
                    "reasoning_trace": trace + [f"Finalized with status: {final_status}"]
                }).eq("id", str(session_id)).execute()
                logger.info(f"[Worker] Session update successful.")
            except Exception as e:
                logger.error(f"[Worker] Failed to update session status: {e}")
            
        return analysis

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_async_wrapper())
        loop.close()
        logger.info("[Worker] Task completed successfully.")
        return result
    except Exception as e:
        logger.error(f"[Worker] Task failed: {e}")
        # Mark session as failed
        if session_id:
            try:
                db = get_supabase()
                # Use a fresh fetch to avoid overwriting agent logs
                res = db.table("scan_sessions").select("reasoning_trace").eq("id", str(session_id)).execute()
                trace = res.data[0]["reasoning_trace"] if res.data else []
                db.table("scan_sessions").update({
                    "status": "failed", 
                    "reasoning_trace": trace + [f"CRITICAL_FAILURE: {str(e)}"]
                }).eq("id", str(session_id)).execute()
            except: pass
        raise e
