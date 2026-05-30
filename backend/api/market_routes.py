
from backend.models.schemas import SuccessResponse
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException

from backend.services.auth_service import (
    get_current_active_user,
    get_current_admin_user,
    get_supabase_rls,
)
from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)

router = APIRouter(prefix="/market", tags=["Market Intelligence"])


@router.post("/scrape/tobb", response_model=SuccessResponse)
async def trigger_tobb_scrape(
    db: Client = Depends(get_supabase_rls),
    admin=Depends(get_current_admin_user),
):
    """
    Triggers the TOBB Fair Calendar Scraper.
    """
    from backend.services.market.tobb_scraper import TOBBScraper

    scraper = TOBBScraper(db)
    result = await scraper.scrape_to_supabase()

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))

    return result


@router.post("/scrape/tga", response_model=SuccessResponse)
async def trigger_tga_scrape(
    db: Client = Depends(get_supabase_rls),
    admin=Depends(get_current_admin_user),
):
    """
    Triggers the TGA Activity Scraper.
    """
    from backend.services.market.tga_scraper import TGAScraper

    scraper = TGAScraper(db)
    result = await scraper.scrape_to_supabase()

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))

    return result


@router.post("/scrape/all", response_model=SuccessResponse)
async def trigger_full_market_sync(
    db: Client = Depends(get_supabase_rls),
    admin=Depends(get_current_admin_user),
):
    """
    Runs both TOBB and TGA scrapers, as well as PredictHQ, Ticketmaster, and Eventbrite integrations.
    """
    from backend.services.market.tga_scraper import TGAScraper
    from backend.services.market.tobb_scraper import TOBBScraper
    from backend.services.market.predicthq_service import PredictHQService
    from backend.services.market.ticketmaster_service import TicketmasterService
    from backend.services.market.eventbrite_service import EventbriteService

    tobb = TOBBScraper(db)
    tga = TGAScraper(db)
    phq = PredictHQService(db)
    tm = TicketmasterService(db)
    eb = EventbriteService(db)

    tobb_res = await tobb.scrape_to_supabase()
    tga_res = await tga.scrape_to_supabase()

    # We trigger these for key hubs
    premium_res = {}
    for city in ["Istanbul", "Antalya", "Ankara"]:
        phq_res = await phq.fetch_and_sync_events(city)
        tm_res = await tm.fetch_and_sync_events(city)
        eb_res = await eb.fetch_and_sync_events(city)
        premium_res[city] = {
            "predicthq": phq_res,
            "ticketmaster": tm_res,
            "eventbrite": eb_res
        }

    return {
        "status": "success",
        "message": "Full market sync completed",
        "data": {
            "tobb": tobb_res,
            "tga": tga_res,
            "premium_integrations": premium_res
        }
    }


@router.post("/scrape/clear", response_model=SuccessResponse)
async def clear_market_events(
    db: Client = Depends(get_supabase_rls),
    admin=Depends(get_current_admin_user),
):
    """
    Clears all market events from the database.
    """
    res = (
        db.table("market_events")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .execute()
    )
    return {"status": "success", "cleared": len(res.data)}


@router.get("/cities", response_model=List[str])
async def get_market_cities(
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Returns a unique list of cities present in the market_events table.
    """
    res = db.table("market_events").select("city").execute()
    cities = sorted(list(set([d["city"] for d in res.data if d.get("city")])))
    return cities


@router.get("/events", response_model=List[Dict[str, Any]])
async def get_market_events(
    city: Optional[str] = None,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Retrieves market events for the dashboard.
    """
    query = db.table("market_events").select("*")
    if city:
        # Case-insensitive match for city
        query = query.ilike("city", city)

    res = query.order("start_date").execute()
    return res.data


@router.get("/forecast", response_model=Dict[str, Any])
async def get_market_forecast(
    city: str,
    days: int = 30,
    language: Optional[str] = "en",
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Returns a 30-day demand compression forecast with AI-generated rationales.
    """
    from backend.agents.demand_agent import DemandScoringAgent
    from backend.agents.price_explanatory_agent import PriceExplanatoryAgent

    demand_agent = DemandScoringAgent(db)
    price_agent = PriceExplanatoryAgent(db)

    raw_forecast = await demand_agent.get_forecast(city, days)

    # 2. Aggregated Metadata
    total_score = 0
    peak_score = -1
    peak_date = None
    critical_days = 0

    total_fair_intensity = 0
    total_tga_intensity = 0
    signal_count = 0

    # 3. Enrich with rationales and compute stats
    enriched_forecast = []
    for day in raw_forecast:
        score = day.get("compression_score", 0)
        total_score += score

        if score > peak_score:
            peak_score = score
            peak_date = day.get("date")

        if score >= 8:
            critical_days += 1

        day_signals = day.get("signals", [])
        for s in day_signals:
            signal_count += 1
            if s.get("type") == "fair":
                total_fair_intensity += s.get("score", 0)
            elif s.get("type") == "announcement":
                total_tga_intensity += s.get("score", 0)

        if day.get("signals"):
            day["rationale"] = await price_agent.generate_rationale(
                day, language=language
            )
        else:
            day["rationale"] = (
                "Market stable. Standard seasonal occupancy expected."
                if language == "en"
                else "Piaysada istikrar hakim. Standart mevsimsel doluluk bekleniyor."
            )
        enriched_forecast.append(day)

    avg_score = (
        round(float(total_score / len(raw_forecast)), 1) if raw_forecast else 0.0
    )

    # 4. Get Last Sync Time
    last_sync = None
    try:
        sync_res = (
            db.table("market_events")
            .select("created_at")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if sync_res.data:
            last_sync = sync_res.data[0]["created_at"]
    except Exception:
        pass

    return {
        "forecast": enriched_forecast,
        "metadata": {
            "avg_compression_score": avg_score,
            "peak_date": peak_date,
            "peak_score": peak_score,
            "critical_days_count": critical_days,
            "total_signals": signal_count,
            "last_synced": last_sync,
            "market_stats": {
                "avg_fair_intensity": round(float(total_fair_intensity / days), 2),
                "avg_tga_intensity": round(float(total_tga_intensity / days), 2),
            },
        },
    }
