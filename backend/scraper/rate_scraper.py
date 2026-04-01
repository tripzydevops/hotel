import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID

from backend.utils.db import get_supabase_client
from backend.agents.scraper_agent import ScraperAgent
from backend.services.scan_persistence import ScanPersistenceService
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class RateScraper:
    """
    Core Monitoring Engine.
    Orchestrates scheduled scans, deduplication, and persistence logic.
    """

    def __init__(self, db=None):
        self.db = db or get_supabase_client(admin=True)
        self.scraper = ScraperAgent(self.db)
        self.persistence = ScanPersistenceService(self.db)
        from backend.agents.analyst_agent import AnalystAgent
        self.analyst = AnalystAgent(self.db)

    async def run_scheduled_scans(self, batch_size: int = 10):
        """
        Main entry point for the periodic scheduler.
        Scans all users due for a refresh and processes their hotels.
        """
        # 1. Fetch pending users
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.db.table("profiles")
            .select("id, scan_frequency_minutes, next_scan_at")
            .lte("next_scan_at", now)
            .limit(batch_size)
            .execute()
        )

        pending_users = res.data or []
        if not pending_users:
            logger.info("No users due for scanning.")
            return

        logger.info(f"Processing scheduled scans for {len(pending_users)} users.")

        for user in pending_users:
            user_id = user["id"]
            # Default to 24 hours if not set
            interval_min = user.get("scan_frequency_minutes") or 1440
            
            # 2. Initialize Session
            session_id = await self._create_session(user_id)
            
            try:
                # 3. Fetch user's hotels
                hotels_res = (
                    self.db.table("hotels")
                    .select("id, name, location, stars")
                    .eq("user_id", user_id)
                    .execute()
                )
                hotels = hotels_res.data or []
                
                if not hotels:
                    logger.info(f"User {user_id} has no hotels to monitor.")
                    await self._complete_session(session_id, "completed_empty")
                    await self._schedule_next_run(user_id, interval_min)
                    continue

                logger.info(f"Scanning {len(hotels)} hotels for user {user_id}.")

                # 4. Perform Scans via ScraperAgent (handles concurrency internally)
                results = await self.scraper.run_scan(
                    user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                    hotels=hotels,
                    options=None, # Default options (tomorrow)
                    session_id=UUID(session_id) if isinstance(session_id, str) else session_id
                )

                # 5. Persist and Analyze
                if results:
                    await self.analyst.analyze_results(
                        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                        scraper_results=results,
                        session_id=UUID(session_id) if isinstance(session_id, str) else session_id
                    )

                # 6. Finalize and Schedule Next
                await self._complete_session(session_id, "completed")
                await self._schedule_next_run(user_id, interval_min)

            except Exception as e:
                logger.error(f"Critical failure in user scan {user_id}: {e}")
                await self._complete_session(session_id, "failed")

    async def _create_session(self, user_id: str) -> str:
        """Creates a tracking session in the database."""
        res = self.db.table("scan_sessions").insert({
            "user_id": user_id,
            "status": "running",
            "session_type": "scheduled_monitor"
        }).execute()
        return res.data[0]["id"]

    async def _complete_session(self, session_id: str, status: str, error: Optional[str] = None):
        """Finalizes the session status."""
        update = {"status": status, "completed_at": datetime.now(timezone.utc).isoformat()}
        self.db.table("scan_sessions").update(update).eq("id", session_id).execute()

    async def _schedule_next_run(self, user_id: str, interval_minutes: int):
        """Calculates and persists the next scan time."""
        next_run = datetime.now(timezone.utc) + timedelta(minutes=interval_minutes)
        self.db.table("profiles").update({
            "next_scan_at": next_run.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()
        logger.info(f"User {user_id} scheduled for next run at {next_run.isoformat()}.")
