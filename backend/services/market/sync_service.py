from datetime import datetime, timedelta, timezone

from backend.services.market.tga_scraper import TGAScraper
from backend.services.market.tobb_scraper import TOBBScraper
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)


async def run_market_sync_if_needed(db: Client):
    """
    Checks the last sync timestamp in the market_events table.
    If $> 14$ days ago, triggers a full fresh scrape.
    """
    try:
        logger.info("[MARKET SYNC] Checking data freshness...")

        # 1. Fetch the latest event creation time
        res = (
            db.table("market_events")
            .select("created_at")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        last_sync = None
        if res.data:
            last_sync_str = res.data[0]["created_at"]
            # datetime.fromisoformat handles the Supabase format safely
            last_sync = datetime.fromisoformat(last_sync_str.replace("Z", "+00:00"))

        now = datetime.now(timezone.utc)

        # 14 days threshold
        threshold = timedelta(days=14)

        should_sync = False
        if not last_sync:
            logger.info(
                "[MARKET SYNC] No existing events found. First-time sync required."
            )
            should_sync = True
        elif (now - last_sync) > threshold:
            logger.info(
                f"[MARKET SYNC] Data is stale. Last sync: {last_sync}. Age: {now - last_sync}. Syncing now..."
            )
            should_sync = True
        else:
            time_left = threshold - (now - last_sync)
            logger.info(
                f"[MARKET SYNC] Data is fresh. Last sync: {last_sync}. Next sync in: {time_left}"
            )

        if should_sync:
            tobb = TOBBScraper(db)
            tga = TGAScraper(db)

            # Run both scrapers (they handle their own Supabase upserts)
            await tobb.scrape_to_supabase()
            await tga.scrape_to_supabase()

            # Trigger premium signal integrations (PredictHQ, Ticketmaster, Eventbrite)
            from backend.services.market.predicthq_service import PredictHQService
            from backend.services.market.ticketmaster_service import TicketmasterService
            from backend.services.market.eventbrite_service import EventbriteService

            # Default to tracking major hubs in Turkey (Istanbul, Antalya, Ankara)
            for city in ["Istanbul", "Antalya", "Ankara"]:
                try:
                    phq = PredictHQService(db)
                    await phq.fetch_and_sync_events(city)
                except Exception as e:
                    logger.error(f"[MARKET SYNC] PredictHQ sync failed for {city}: {e}")

                try:
                    tm = TicketmasterService(db)
                    await tm.fetch_and_sync_events(city)
                except Exception as e:
                    logger.error(f"[MARKET SYNC] Ticketmaster sync failed for {city}: {e}")

                try:
                    eb = EventbriteService(db)
                    await eb.fetch_and_sync_events(city)
                except Exception as e:
                    logger.error(f"[MARKET SYNC] Eventbrite sync failed for {city}: {e}")

            logger.info(
                "[MARKET SYNC] Bi-weekly automation cycle completed successfully."
            )

    except Exception as e:
        logger.error(f"[MARKET SYNC] Failed to execute market sync check: {str(e)}")
