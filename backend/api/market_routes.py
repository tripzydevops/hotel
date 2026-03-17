from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Any, cast, Dict
from supabase import Client
from backend.utils.db import get_supabase_rls
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/market", tags=["Market Intelligence"])

@router.post("/scrape/tobb")
async def trigger_tobb_scrape(db: Client = Depends(get_supabase_rls)):
    """
    [Stealth Mode] Triggers the TOBB Fair Calendar Scraper.
    """
    from backend.services.market.tobb_scraper import TOBBScraper
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
    from backend.services.market.tga_scraper import TGAScraper
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
    from backend.services.market.tobb_scraper import TOBBScraper
    from backend.services.market.tga_scraper import TGAScraper
    tobb = TOBBScraper(db)
    tga = TGAScraper(db)
    
    tobb_res = await tobb.scrape_to_supabase()
    tga_res = await tga.scrape_to_supabase()
    
    return {
        "tobb": tobb_res,
        "tga": tga_res
    }

@router.post("/scrape/clear")
async def clear_market_events(db: Client = Depends(get_supabase_rls)):
    """
    [Dev Tools] Clears all market events from the database.
    """
    res = db.table("market_events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    return {"status": "success", "cleared": len(res.data)}

@router.get("/cities")
async def get_market_cities(db: Client = Depends(get_supabase_rls)):
    """
    Returns a unique list of cities present in the market_events table.
    """
    res = db.table("market_events").select("city").execute()
    data = cast(List[Dict[str, Any]], res.data or [])
    cities = sorted(list(set([str(d["city"]) for d in data if d.get("city")])))
    return cities

@router.get("/events")
async def get_market_events(city: Optional[str] = None, db: Client = Depends(get_supabase_rls)):
    """
    Retrieves market events for the dashboard.
    """
    query = db.table("market_events").select("*")
    if city:
        # KAİZEN: Case-insensitive match for city
        query = query.ilike("city", city)
    
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
    from backend.agents.demand_agent import DemandScoringAgent
    from backend.agents.price_explanatory_agent import PriceExplanatoryAgent
    
    demand_agent = DemandScoringAgent(db)
    price_agent = PriceExplanatoryAgent(db)
    
    raw_forecast = await demand_agent.get_forecast(city, days)
    
    # 2. Aggregated Metadata
    f_total_score: float = 0.0
    peak_score: float = -1.0
    peak_date: Optional[str] = None
    critical_days: int = 0
    
    total_fair_intensity: float = 0.0
    total_tga_intensity: float = 0.0
    signal_count: int = 0
    
    # 3. Enrich with rationales and compute stats
    enriched_forecast = []
    for day in raw_forecast:
        # Cast to dict since day is a JSON object
        d_dict = cast(Dict[str, Any], day)
        s_val = d_dict.get("compression_score", 0)
        score = float(s_val)
        f_total_score += score
        
        if score > peak_score:
            peak_score = score
            p_date = d_dict.get("date")
            peak_date = cast(Optional[str], str(p_date) if p_date else None)
        
        if score >= 8:
            critical_days += 1
            
        day_signals = cast(List[Any], d_dict.get("signals", []))
        for s in day_signals:
            s_dict = cast(Dict[str, Any], s)
            signal_count += 1
            s_score_val = s_dict.get("score", 0)
            f_score = float(s_score_val)
            if s_dict.get("type") == "fair":
                total_fair_intensity += f_score
            elif s_dict.get("type") == "announcement":
                total_tga_intensity += f_score

        if d_dict.get("signals"):
            day["rationale"] = await price_agent.generate_rationale(day)
        else:
            day["rationale"] = "Market stable. Standard seasonal occupancy expected."
        enriched_forecast.append(day)
        
    avg_score: float = 0.0
    if raw_forecast:
        avg_score = round(cast(float, f_total_score / float(len(raw_forecast))), 1)
    
    # 4. Get Last Sync Time
    last_sync: Optional[str] = None
    try:
        sync_res = db.table("market_events").select("created_at").order("created_at", desc=True).limit(1).execute()
        if sync_res.data and len(sync_res.data) > 0:
            row = cast(Dict[str, Any], sync_res.data[0])
            last_sync = cast(str, str(row.get("created_at", "")))
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
                "avg_fair_intensity": round(cast(float, total_fair_intensity / float(days)), 2),
                "avg_tga_intensity": round(cast(float, total_tga_intensity / float(days)), 2)
            }
        }
    }
