"""
[Global Pulse Phase 2] — Pulse Routes
API endpoints for the Global Pulse network intelligence layer.

EXPLANATION:
This router exposes the /api/global-pulse/stats endpoint which returns
real-time network metrics (active users, hotels monitored, cache hit rate).
The existing /api/global-pulse endpoint in dashboard_routes.py handles
the "Recent Wins" feed — this new router extends the Pulse API surface.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from supabase import Client

from backend.utils.db import get_supabase
from backend.services.pulse_service import get_pulse_network_stats

router = APIRouter(prefix="/api/global-pulse", tags=["pulse"])


@router.get("/stats")
async def get_network_stats(db: Client = Depends(get_supabase)):
    """
    Returns live Global Pulse network metrics.
    Used by GlobalPulseFeed.tsx to display real-time stats
    instead of hardcoded placeholder values.
    
    EXPLANATION:
    This endpoint is public (no auth required) because the stats
    are anonymized aggregate counts. No user-specific data is exposed.
    The service layer caches results for 5 minutes to reduce DB load.
    """
    stats = await get_pulse_network_stats(db)
    return JSONResponse(content=jsonable_encoder(stats))
