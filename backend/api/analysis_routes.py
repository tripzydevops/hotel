
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Any, Dict, List, cast
from uuid import UUID
from supabase import Client
from backend.services.auth_service import get_current_active_user
from backend.utils.db import get_supabase_rls

# from backend.agents.analyst_agent import AnalystAgent  # Lazy loaded below
from datetime import date
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import json
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/v1/discovery/{hotel_id}")
async def discover_competitors_v1(
    hotel_id: str,
    limit: int = 5,
    current_user=Depends(get_current_active_user),
    db: Client = Depends(get_supabase_rls),
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
@router.post("/analysis/market")
@router.get("/analysis")
async def get_market_intelligence(
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    exclude_hotel_ids: Optional[str] = None,
    search_query: Optional[str] = None,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Generates a deep market analysis for the user's city.
    """
    # EXPLANATION: Thin Route Handler (Refactored)
    user_id = current_user.id
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
            exclude_hotel_ids=exclude_hotel_ids,
            search_query=search_query,
        )

        return JSONResponse(content=jsonable_encoder(analysis_data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/discovery/{hotel_id}")
async def discover_competitors_trigger(
    hotel_id: UUID,
    db: Client = Depends(get_supabase_rls),
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
    db: Client = Depends(get_supabase_rls),
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


@router.get("/analysis/debug")
async def debug_analysis_data(
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Diagnostic endpoint for Reports page debugging.
    """
    from datetime import datetime, timedelta

    try:
        user_id = current_user.id
        if not db:
            raise HTTPException(503, "Database unavailable")

        diag: Dict[str, Any] = {"user_id": str(user_id), "timestamp": datetime.utcnow().isoformat()}

        # 1. Hotels for this user
        hotels_res = (
            db.table("hotels")
            .select("id, name, is_target_hotel, location, serp_api_id")
            .eq("user_id", str(user_id))
            .execute()
        )
        hotels = hotels_res.data or []
        diag["hotel_count"] = len(hotels)
        diag["hotels"] = []
        for h in hotels:
            h_dict = cast(Dict[str, Any], h)
            h_id = str(h_dict.get("id", ""))
            h_name = str(h_dict.get("name", "?"))
            diag["hotels"].append({
                "id": cast(Any, h_id)[:8],
                "name": cast(Any, h_name)[:30],
                "is_target": bool(h_dict.get("is_target_hotel")),
                "has_serp_id": bool(h_dict.get("serp_api_id")),
            })

        if not hotels:
            return JSONResponse(content=jsonable_encoder(diag))

        # 2. Market Events
        events_res = db.table("market_events").select("*").order("created_at", desc=True).limit(5).execute()
        events = events_res.data or []
        diag["event_count"] = len(events)
        diag["events"] = []
        for e in events:
            e_dict = cast(Dict[str, Any], e)
            e_id = str(e_dict.get("id", ""))
            e_title = str(e_dict.get("title", "Event"))
            e_date = str(e_dict.get("created_at", ""))
            diag["events"].append({
                "id": cast(Any, e_id)[:8],
                "title": cast(Any, e_title)[:40],
                "date": cast(Any, e_date)[:10],
            })

        # 3. Recent Scans
        scans_res = db.table("price_scans").select("*").order("created_at", desc=True).limit(3).execute()
        scans = scans_res.data or []
        diag["scan_count"] = len(scans)
        diag["scans"] = []
        for s in scans:
            s_dict = cast(Dict[str, Any], s)
            s_id = str(s_dict.get("id", ""))
            s_hotel = str(s_dict.get("hotel_id", ""))
            diag["scans"].append({
                "id": cast(Any, s_id)[:8],
                "hotel": cast(Any, s_hotel)[:8],
                "status": "Success" if s.get("success") else "Failed",
            })

        hotel_ids = [str(h["id"]) for h in hotels]

        # 4. Price logs count (all time)
        all_time = (
            db.table("price_logs")
            .select("id", count="exact")
            .in_("hotel_id", hotel_ids)
            .execute()
        )
        diag["price_logs_all_time"] = all_time.count

        # 5. Price logs count (90 day window - what analysis actually uses)
        cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()
        windowed = (
            db.table("price_logs")
            .select("id", count="exact")
            .in_("hotel_id", hotel_ids)
            .gte("recorded_at", cutoff)
            .execute()
        )
        diag["price_logs_90_days"] = windowed.count

        # 6. Recent price logs (last 5)
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
            r_dict = cast(Dict[str, Any], r)
            rt = r_dict.get("room_types") or []
            r_hotel_id = str(r_dict.get("hotel_id", "?"))
            r_recorded_at = str(r_dict.get("recorded_at", "?"))
            diag["recent_logs"].append(
                {
                    "hotel_id": cast(Any, r_hotel_id)[:8],
                    "name": r_dict.get("hotel_name"),
                    "price": r_dict.get("price"),
                    "currency": r_dict.get("currency"),
                    "recorded_at": cast(Any, r_recorded_at)[:19],
                    "source": r_dict.get("source"),
                    "is_estimated": r_dict.get("is_estimated"),
                    "room_types_in_log": len(rt) if isinstance(rt, list) else 0,
                    "room_names": [
                        str(room.get("name")) for room in rt if isinstance(room, dict)
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
                s_dict = cast(Dict[str, Any], s)
                trace = cast(List[Any], s_dict.get("reasoning_trace") or [])
                s_created = str(s_dict.get("created_at", "?"))
                s_completed = cast(Optional[str], s_dict.get("completed_at"))
                diag["recent_scans"].append(
                    {
                        "status": s_dict.get("status"),
                        "created_at": cast(Any, s_created)[:19],
                        "completed_at": cast(Any, s_completed)[:19]
                        if s_completed
                        else None,
                        "trace_summary": cast(Any, trace)[-3:]
                        if isinstance(trace, list)
                        else cast(Any, str(trace))[:200],
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
        elif all(cast(Dict[str, Any], r).get("price", 0) <= 0 for r in (recent.data or [])):
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


@router.get("/v2/analysis/stream")
async def stream_market_intelligence(
    room_type: str = "Standard",
    display_currency: str = "TRY",
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Client = Depends(get_supabase_rls),
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
            user_id = current_user.id
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
