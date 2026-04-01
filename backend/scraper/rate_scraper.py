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
        Scans all active users due for a refresh and processes their hotels.
        """
        # 1. Identify active users (Trial/Active only)
        active_res = self.db.table("user_profiles").select("user_id").in_(
            "subscription_status", ["active", "trial"]
        ).execute()

        active_user_ids = [str(u["user_id"]) for u in active_res.data or []]
        if not active_user_ids:
            logger.info("No active users found for scheduled scanning.")
            return

        # 2. Fetch pending users due for scanning
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.db.table("profiles")
            .select("id, scan_frequency_minutes, next_scan_at")
            .in_("id", active_user_ids)
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
            interval_min = user.get("scan_frequency_minutes") or 1440
            intended_at_str = user.get("next_scan_at")

            # 3. Initialize Session
            session_id = await self._create_session(user_id)

            try:
                # FIX 2: Exclude soft-deleted hotels
                hotels_res = (
                    self.db.table("hotels")
                    .select("id, name, location, stars")
                    .eq("user_id", user_id)
                    .is_("deleted_at", "null")
                    .execute()
                )
                hotels = hotels_res.data or []

                if not hotels:
                    logger.info(f"User {user_id} has no hotels to monitor.")
                    await self._complete_session(session_id, "completed_empty")
                    # FIX 3: Anti-drift scheduling
                    await self._schedule_next_run(user_id, interval_min, intended_at_str)
                    continue

                logger.info(f"Scanning {len(hotels)} hotels for user {user_id}.")

                # 4. Perform Scans via ScraperAgent (handles concurrency internally)
                results = await self.scraper.run_scan(
                    user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                    hotels=hotels,
                    options=None,
                    session_id=UUID(session_id) if isinstance(session_id, str) else session_id
                )

                # 5. Persist and Analyze
                if results:
                    await self.analyst.analyze_results(
                        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                        scraper_results=results,
                        session_id=UUID(session_id) if isinstance(session_id, str) else session_id
                    )

                # 6. Finalize and Schedule Next Run
                await self._complete_session(session_id, "completed")
                await self._schedule_next_run(user_id, interval_min, intended_at_str)

            except Exception as e:
                logger.error(f"Critical failure in user scan {user_id}: {e}")
                await self._complete_session(session_id, "failed", error=str(e))

    async def _create_session(self, user_id: str) -> str:
        """Creates a tracking session in the database."""
        res = self.db.table("scan_sessions").insert({
            "user_id": user_id,
            "status": "running",
            "session_type": "scheduled" # Align with monitor_service naming
        }).execute()
        return res.data[0]["id"]

    async def _complete_session(self, session_id: str, status: str, error: Optional[str] = None):
        """Finalizes the session status."""
        update = {"status": status, "completed_at": datetime.now(timezone.utc).isoformat()}
        if error:
            update["reasoning_trace"] = [error]
        self.db.table("scan_sessions").update(update).eq("id", session_id).execute()

    async def _schedule_next_run(self, user_id: str, interval_minutes: int, intended_at_str: Optional[str] = None):
        """FIX 3: Calculates the next scan time using anti-drift logic."""
        now_dt = datetime.now(timezone.utc)

        if intended_at_str:
            try:
                # Calculate relative to the INTENDED schedule time, not NOW
                intended_at = datetime.fromisoformat(intended_at_str.replace("Z", "+00:00"))
                next_run = intended_at + timedelta(minutes=interval_minutes)

                # Safety clamp: if we are catastrophically behind, don't schedule in the past
                if next_run < now_dt:
                    next_run = now_dt + timedelta(minutes=interval_minutes)
            except Exception:
                next_run = now_dt + timedelta(minutes=interval_minutes)
        else:
            next_run = now_dt + timedelta(minutes=interval_minutes)

        self.db.table("profiles").update({
            "next_scan_at": next_run.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()

        logger.info(f"User {user_id} scheduled for next run at {next_run.isoformat()}.")
