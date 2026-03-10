from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from supabase import Client
from backend.utils.db import get_supabase_rls
from backend.services.market.tobb_scraper import TOBBScraper
from backend.services.market.tga_scraper import TGAScraper
from backend.agents.demand_agent import DemandScoringAgent
from backend.agents.price_explanatory_agent import PriceExplanatoryAgent
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/market", tags=["Market Intelligence"])

@router.post("/scrape/tobb")
async def trigger_tobb_scrape(db: Client = Depends(get_supabase_rls)):
    """
    [Stealth Mode] Triggers the TOBB Fair Calendar Scraper.
    """
    scraper = TOBBScraper(db)
    result = await scraper.scrape_to_supabase()
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    
    return result

@router.post("/scrape/tga")
async def trigger_tga_scrape(db: Client = Depends(get_supabase_rls)):
    """
    [Stealth Mode] Triggers the TGA Activity Scraper.
    """
    scraper = TGAScraper(db)
    result = await scraper.scrape_to_supabase()
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    
    return result

@router.post("/scrape/all")
async def trigger_full_market_sync(db: Client = Depends(get_supabase_rls)):
    """
    Runs both TOBB and TGA scrapers in sequence.
    """
    tobb = TOBBScraper(db)
    tga = TGAScraper(db)
    
    tobb_res = await tobb.scrape_to_supabase()
    tga_res = await tga.scrape_to_supabase()
    
    return {
        "tobb": tobb_res,
        "tga": tga_res
    }

@router.get("/events")
async def get_market_events(city: str = None, db: Client = Depends(get_supabase_rls)):
    """
    Retrieves market events for the dashboard.
    """
    query = db.table("market_events").select("*")
    if city:
        query = query.eq("city", city.capitalize())
    
    res = query.order("start_date").execute()
    return res.data

@router.get("/forecast")
async def get_market_forecast(
    city: str, 
    days: int = 30, 
    db: Client = Depends(get_supabase_rls)
):
    """
    Returns a 30-day demand compression forecast with AI-generated rationales.
    """
    demand_agent = DemandScoringAgent(db)
    price_agent = PriceExplanatoryAgent(db)
    
    raw_forecast = await demand_agent.get_forecast(city, days)
    
    # Enrich with rationales
    enriched_forecast = []
    for day in raw_forecast:
        if day.get("signals"):
            day["rationale"] = await price_agent.generate_rationale(day)
        else:
            day["rationale"] = "Market stable. Standard seasonal occupancy expected."
        enriched_forecast.append(day)
        
    return enriched_forecast
