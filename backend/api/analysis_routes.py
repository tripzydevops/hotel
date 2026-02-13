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

@router.post("/analysis/market/{user_id}")
async def get_market_intelligence(
    user_id: UUID,
    room_type: str = "Standard",
    display_currency: str = "TRY",
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
        # ... logic ...
        if not db:
            raise HTTPException(503, "Database unavailable")
        
        hotels_result = db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        hotels = hotels_result.data or []
        if not hotels:
            return {"summary": {}, "hotels": []}

        hotel_prices_map = {str(h["id"]): h.get("latest_price", 0) for h in hotels}
        
        # Room Type Slicing Logic (pgvector)
        allowed_room_names_map = {}
        try:
            catalog_res = db.table("room_type_catalog").select("embedding") \
                .ilike("normalized_name", f"%{room_type}%").limit(1).execute()
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
            allowed_room_names_map=allowed_room_names_map,
            db=db
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
