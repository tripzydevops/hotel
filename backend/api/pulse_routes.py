
from backend.models.schemas import GlobalPulseStatsResponse
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
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from backend.services.pulse_service import get_pulse_network_stats
from backend.utils.db import get_supabase
from supabase import Client

# EXPLANATION: Routing Normalization (Regression Fix)
# Removed "/api" prefix from APIRouter to avoid doubled paths
# (e.g., /api/api/global-pulse/...) when registered in main.py.
router = APIRouter(prefix="/global-pulse", tags=["pulse"])


@router.get("/stats", response_model=GlobalPulseStatsResponse)
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
