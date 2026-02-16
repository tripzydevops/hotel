from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.agents.analyst_agent import AnalystAgent
from backend.services.analysis_service import perform_market_analysis
from datetime import date
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/api", tags=["analysis"])

@router.get("/v1/discovery/{hotel_id}")
async def discover_competitors_v1(hotel_id: str, limit: int = 5, current_user = Depends(get_current_active_user), db: Client = Depends(get_supabase)):
    """
    Autonomous Rival Discovery.
    """
    # EXPLANATION: AI-Driven Competitor Discovery
    # Uses vector search and semantic similarity to automatically identify 
    # potential competitors for a newly tracked hotel.
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        agent = AnalystAgent(db)
        rivals = await agent.discover_rivals(hotel_id, limit=limit)
        return rivals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# EXPLANATION: Dual Route Registration
# The frontend (lib/api.ts) calls GET /api/analysis/{userId} but the original
# route was POST /api/analysis/market/{user_id}. Both path and method were 
# mismatched, causing all analysis pages to show "N/A" / empty data.
# We register BOTH to maintain backward compatibility.
@router.post("/analysis/market/{user_id}")
@router.get("/analysis/{user_id}")
async def get_market_intelligence(
    user_id: UUID,
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    Generates a deep market analysis for the user's city.
    Utilizes pgvector for semantic room matching and price triangulation.
    """
    # EXPLANATION: Market Intelligence Engine
    # Performs complex multi-hotel analysis, including ARI (Average Rate Index) 
    # and Sentiment Index calculations to power the dashboard analytics.
    try:
        # EXPLANATION: Currency Alias
        # Frontend sends ?currency=TRY, backend uses display_currency internally.
        if currency:
            display_currency = currency
            
        if not db:
            raise HTTPException(503, "Database unavailable")
        
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        if not hotels:
            return {"summary": {}, "hotels": []}

        # EXPLANATION: Unified Price History (Bridging 1,357 Legacy Records)
        # Why: The new 'price_logs' table (Active) is structured for deep parity analysis 
        # but is currently sparse. The old 'query_logs' table (Legacy) contains months 
        # of audit history.
        # How: We query both sources. 'query_logs' are normalized into the modern 
        # format on-the-fly, ensuring the Rate Calendar and Pulse charts show 
        # continuous data without "N/A" gaps from the migration.
        
        # 1. Fetch from price_logs
        price_logs_res = db.table("price_logs") \
            .select("*") \
            .in_("hotel_id", [str(h["id"]) for h in hotels]) \
            .order("recorded_at", desc=True) \
            .limit(5000) \
            .execute()
        logs_data = price_logs_res.data or []
        
        # 2. Fetch from query_logs (Fallback for historical depth)
        hotel_names = [h["name"] for h in hotels]
        query_logs_res = db.table("query_logs") \
            .select("hotel_name, action_type, price, currency, created_at, vendor") \
            .in_("hotel_name", hotel_names) \
            .in_("action_type", ["monitor", "search"]) \
            .not_.is_("price", "null") \
            .order("created_at", desc=True) \
            .limit(5000) \
            .execute()
        
        # Normalize query_logs to match price_logs schema for the aggregator
        for q_log in (query_logs_res.data or []):
            hid = next((str(h["id"]) for h in hotels if h["name"] == q_log["hotel_name"]), None)
            if hid:
                logs_data.append({
                    "hotel_id": hid,
                    "price": q_log["price"],
                    "currency": q_log["currency"] or "TRY",
                    "recorded_at": q_log["created_at"],
                    "vendor": q_log["vendor"] or "SerpApi",
                    "check_in_date": q_log["created_at"].split('T')[0], # Fallback date
                    "source": "legacy_query_log"
                })
        
        # Group logs by hotel_id
        hotel_prices_map = {}
        for log in logs_data:
            hid = str(log["hotel_id"])
            if hid not in hotel_prices_map:
                hotel_prices_map[hid] = []
            hotel_prices_map[hid].append(log)
            
        # Ensure every hotel has at least an empty list if no logs found
        for h in hotels:
            hid = str(h["id"])
            if hid not in hotel_prices_map:
                hotel_prices_map[hid] = []
        
        # Room Type Slicing Logic (pgvector)
        allowed_room_names_map = {}
        try:
            catalog_res = db.table("room_type_catalog").select("embedding") \
                .ilike("normalized_name", f"%{room_type}%").limit(1).execute()
            
            # Fallback for Standard/Standart mismatch in catalog
            if not catalog_res.data and room_type.lower() == "standard":
                catalog_res = db.table("room_type_catalog").select("embedding") \
                    .ilike("normalized_name", "%standart%").limit(1).execute()
            elif not catalog_res.data and room_type.lower() == "standart":
                catalog_res = db.table("room_type_catalog").select("embedding") \
                    .ilike("normalized_name", "%standard%").limit(1).execute()

            if catalog_res.data:
                embedding = catalog_res.data[0]["embedding"]
                matches_res = db.rpc("match_room_types", {
                    "query_embedding": embedding,
                    "match_threshold": 0.82,
                    "match_count": 100 
                }).execute()
                for match in (matches_res.data or []):
                    hid = str(match["hotel_id"])
                    if hid not in allowed_room_names_map:
                        allowed_room_names_map[hid] = set()
                    allowed_room_names_map[hid].add(match["original_name"])
                for h in hotels:
                    hid = str(h["id"])
                    if hid not in allowed_room_names_map:
                        allowed_room_names_map[hid] = set()
                    allowed_room_names_map[hid].add(room_type)
        except Exception:
            pass

        analysis_data = await perform_market_analysis(
            user_id=str(user_id),
            hotels=hotels,
            hotel_prices_map=hotel_prices_map,
            display_currency=display_currency,
            room_type=room_type,
            start_date=start_date,
            end_date=end_date,
            allowed_room_names_map=allowed_room_names_map
        )
        return JSONResponse(content=jsonable_encoder(analysis_data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analysis/discovery/{hotel_id}")
async def discover_competitors_trigger(hotel_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """Trigger Ghost Competitor Discovery."""
    try:
        analyst = AnalystAgent(db)
        hotel = db.table("hotels").select("*").eq("id", str(hotel_id)).single().execute()
        if not hotel.data:
            raise HTTPException(404, "Hotel not found")
        serp_api_id = hotel.data.get("serp_api_id")
        if not serp_api_id:
            raise HTTPException(400, "Hotel has no SerpApi ID for discovery")
        return await analyst.discover_rivals(str(hotel_id), limit=5)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/analysis/{hotel_id}/sentiment-history")
async def get_sentiment_history(
    hotel_id: str,
    days: int = 30,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    Fetches historical sentiment breakdown for a hotel.
    Used for the 6-month trend chart on the Sentiment Analysis page.
    """
    from backend.utils.sentiment_utils import normalize_sentiment
    
    try:
        # Fetch history records
        # Note: We filter by hotel_id and limit by days
        res = db.table("sentiment_history") \
            .select("*") \
            .eq("hotel_id", hotel_id) \
            .order("created_at", desc=True) \
            .limit(days) \
            .execute()
        
        history = []
        for record in (res.data or []):
            # Normalizing the breakdown stored in the history record
            raw_breakdown = record.get("sentiment_breakdown") or record.get("breakdown") or []
            normalized = normalize_sentiment(raw_breakdown)
            
            history.append({
                "date": record.get("created_at"),
                "rating": record.get("rating"),
                "breakdown": normalized
            })
            
        return {"history": history}
    except Exception as e:
        print(f"[AnalysisRoutes] Sentiment history fetch failed: {e}")
        return []
