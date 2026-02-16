from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user
from backend.agents.analyst_agent import AnalystAgent
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
    
    EXPLANATION: Thin Route Handler (Refactored)
    All business logic (legacy log merging, pgvector room matching, price aggregation)
    has been moved to analysis_service.get_market_intelligence_data().
    This route only handles HTTP concerns: dependency injection, response formatting, errors.
    """
    from backend.services.analysis_service import get_market_intelligence_data
    
    try:
        if not db:
            raise HTTPException(503, "Database unavailable")
            
        analysis_data = await get_market_intelligence_data(
            db=db,
            user_id=str(user_id),
            room_type=room_type,
            display_currency=currency if currency else display_currency,
            currency=currency,
            start_date=str(start_date) if start_date else None,
            end_date=str(end_date) if end_date else None
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
