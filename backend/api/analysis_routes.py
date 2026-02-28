from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user

# from backend.agents.analyst_agent import AnalystAgent  # Lazy loaded below
from datetime import date
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import json
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/v1/discovery/{hotel_id}")
async def discover_competitors_v1(
    hotel_id: str,
    limit: int = 5,
    current_user=Depends(get_current_active_user),
    db: Client = Depends(get_supabase),
):
    """
    Autonomous Rival Discovery.
    """
    # EXPLANATION: AI-Driven Competitor Discovery
    # Uses vector search and semantic similarity to automatically identify
    # potential competitors for a newly tracked hotel.
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        from backend.agents.analyst_agent import AnalystAgent

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
    current_user=Depends(get_current_active_user),
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
            end_date=str(end_date) if end_date else None,
        )

        return JSONResponse(content=jsonable_encoder(analysis_data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/discovery/{hotel_id}")
async def discover_competitors_trigger(
    hotel_id: UUID,
    db: Client = Depends(get_supabase),
    current_user=Depends(get_current_active_user),
):
    """Trigger Ghost Competitor Discovery."""
    try:
        from backend.agents.analyst_agent import AnalystAgent

        analyst = AnalystAgent(db)
        hotel = (
            db.table("hotels").select("*").eq("id", str(hotel_id)).single().execute()
        )
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
    current_user=Depends(get_current_active_user),
):
    """
    Fetches historical sentiment breakdown for a hotel.
    Used for the 6-month trend chart on the Sentiment Analysis page.
    """
    from backend.utils.sentiment_utils import normalize_sentiment
    from backend.utils.logger import get_logger

    try:
        # Fetch history records
        # Note: We filter by hotel_id and limit by days
        res = (
            db.table("sentiment_history")
            .select("*")
            .eq("hotel_id", hotel_id)
            .order("created_at", desc=True)
            .limit(days)
            .execute()
        )

        history = []
        for record in res.data or []:
            # Normalizing the breakdown stored in the history record
            raw_breakdown = (
                record.get("sentiment_breakdown") or record.get("breakdown") or []
            )
            normalized = normalize_sentiment(raw_breakdown)

            history.append(
                {
                    "date": record.get("recorded_at")
                    or record.get(
                        "created_at"
                    ),  # [FIX] Use recorded_at as primary date
                    "rating": record.get("rating"),
                    "breakdown": normalized,
                }
            )

        return {"history": history}
    except Exception as e:
        get_logger(__name__).error(f"Sentiment history fetch failed: {e}")
        return []


@router.get("/analysis/debug/{user_id}")
async def debug_analysis_data(
    user_id: UUID,
    db: Client = Depends(get_supabase),
    current_user=Depends(get_current_active_user),
):
    """
    Diagnostic endpoint for Reports page debugging.

    EXPLANATION: Data Pipeline Inspector
    Returns a concise summary of what the analysis endpoint would see,
    without running the full analysis. Helps identify where data drops off.
    """
    from datetime import datetime, timedelta

    try:
        if not db:
            raise HTTPException(503, "Database unavailable")

        diag = {"user_id": str(user_id), "timestamp": datetime.utcnow().isoformat()}

        # 1. Hotels for this user
        hotels_res = (
            db.table("hotels")
            .select("id, name, is_target_hotel, location, serp_api_id")
            .eq("user_id", str(user_id))
            .execute()
        )
        hotels = hotels_res.data or []
        diag["hotel_count"] = len(hotels)
        diag["hotels"] = [
            {
                "id": str(h["id"])[:8],
                "name": h.get("name", "?")[:30],
                "is_target": h.get("is_target_hotel"),
                "has_serp_id": bool(h.get("serp_api_id")),
            }
            for h in hotels
        ]

        if not hotels:
            diag["issue"] = "NO_HOTELS - User has no hotels configured"
            return JSONResponse(content=jsonable_encoder(diag))

        hotel_ids = [str(h["id"]) for h in hotels]

        # 2. Price logs count (all time)
        all_time = (
            db.table("price_logs")
            .select("id", count="exact")
            .in_("hotel_id", hotel_ids)
            .execute()
        )
        diag["price_logs_all_time"] = all_time.count

        # 3. Price logs count (90 day window - what analysis actually uses)
        cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()
        windowed = (
            db.table("price_logs")
            .select("id", count="exact")
            .in_("hotel_id", hotel_ids)
            .gte("recorded_at", cutoff)
            .execute()
        )
        diag["price_logs_90_days"] = windowed.count

        # 4. Recent price logs (last 5)
        recent = (
            db.table("price_logs")
            .select("hotel_id, price, currency, recorded_at, source, is_estimated")
            .in_("hotel_id", hotel_ids)
            .order("recorded_at", desc=True)
            .limit(5)
            .execute()
        )
        diag["recent_logs"] = []
        for r in recent.data or []:
            rt = r.get("room_types") or []
            diag["recent_logs"].append(
                {
                    "hotel_id": str(r.get("hotel_id", "?"))[:8],
                    "price": r.get("price"),
                    "currency": r.get("currency"),
                    "recorded_at": str(r.get("recorded_at", "?"))[:19],
                    "source": r.get("source"),
                    "is_estimated": r.get("is_estimated"),
                    "room_types_in_log": len(rt) if isinstance(rt, list) else "N/A",
                    "room_names": [
                        room.get("name") for room in rt if isinstance(room, dict)
                    ]
                    if isinstance(rt, list)
                    else [],
                }
            )

        # 5. Scan sessions (last 3)
        try:
            sessions = (
                db.table("scan_sessions")
                .select("id, status, created_at, completed_at, reasoning_trace")
                .eq("user_id", str(user_id))
                .order("created_at", desc=True)
                .limit(3)
                .execute()
            )
            diag["recent_scans"] = []
            for s in sessions.data or []:
                trace = s.get("reasoning_trace") or []
                diag["recent_scans"].append(
                    {
                        "status": s.get("status"),
                        "created_at": str(s.get("created_at", "?"))[:19],
                        "completed_at": str(s.get("completed_at", "?"))[:19]
                        if s.get("completed_at")
                        else None,
                        "trace_summary": trace[-3:]
                        if isinstance(trace, list)
                        else str(trace)[:200],
                    }
                )
        except Exception:
            diag["recent_scans"] = "Error fetching scan sessions"

        # 6. Determine likely issue
        if diag["price_logs_all_time"] == 0:
            diag["likely_issue"] = (
                "NO_PRICE_LOGS - No scans have ever successfully stored price data for these hotels"
            )
        elif diag["price_logs_90_days"] == 0:
            diag["likely_issue"] = (
                "STALE_DATA - Price logs exist but none within the 90-day analysis window"
            )
        elif all(r.get("price", 0) <= 0 for r in (recent.data or [])):
            diag["likely_issue"] = (
                "ALL_SELLOUT - All recent price logs have price=0 (key exhaustion / no prices found)"
            )
        else:
            diag["likely_issue"] = (
                "DATA_EXISTS - Price data looks present. Issue may be in room matching or currency conversion"
            )

        return JSONResponse(content=jsonable_encoder(diag))
    except Exception as e:
        raise HTTPException(500, f"Debug endpoint error: {str(e)}")


@router.get("/v2/analysis/stream/{user_id}")
async def stream_market_intelligence(
    user_id: UUID,
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Client = Depends(get_supabase),
    current_user=Depends(get_current_active_user),
):
    """
    KAIZEN: AI Business Intelligence Stream (SSE)
    Streams market data followed by real-time generated narratives.
    """
    from backend.services.analysis_service import (
        get_market_intelligence_data,
        stream_narrative_gen,
    )

    async def event_generator():
        try:
            # 1. Immediate Market Stats
            analysis_data = await get_market_intelligence_data(
                db=db,
                user_id=str(user_id),
                room_type=room_type,
                display_currency=currency if currency else display_currency,
                currency=currency,
                start_date=str(start_date) if start_date else None,
                end_date=str(end_date) if end_date else None,
            )

            # Send initial payload
            yield {
                "event": "data_init",
                "data": json.dumps(jsonable_encoder(analysis_data)),
            }

            # 2. Stream AI Narrative
            async for chunk in stream_narrative_gen(analysis_data, db=db):
                yield {"event": "narrative_chunk", "data": json.dumps({"chunk": chunk})}

            yield {"event": "complete", "data": "done"}

        except Exception as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_generator())
