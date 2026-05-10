"""
Admin — Market Intelligence Aggregator
========================================
Provides aggregated analytics across hotels, scans, and pricing
for the admin dashboard overview panels.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_market_overview_logic(
    db: Client,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Return a high-level market overview across all monitored hotels.
    Includes total scans, average parity score, OTA coverage, and
    price-change velocity for the given time window.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    overview: Dict[str, Any] = {
        "period_days": days,
        "total_hotels": 0,
        "total_scans": 0,
        "avg_parity_score": None,
        "price_changes": 0,
        "ota_coverage": {},
    }

    # --- Hotel count ---
    try:
        res = db.table("hotels").select("id", count="exact").execute()
        overview["total_hotels"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Hotel count query failed: {e}")

    # --- Scan count in window ---
    try:
        res = (
            db.table("extraction_sessions")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        overview["total_scans"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Scan count query failed: {e}")

    # --- Average parity score ---
    try:
        res = (
            db.table("parity_scores")
            .select("score")
            .gte("created_at", cutoff)
            .execute()
        )
        scores = [r["score"] for r in (res.data or []) if r.get("score") is not None]
        if scores:
            overview["avg_parity_score"] = round(sum(scores) / len(scores), 2)
    except PostgRESTError as e:
        logger.warning(f"Parity score aggregation failed: {e}")
    except (KeyError, TypeError, ValueError) as e:
        logger.warning(f"Parity score data error: {e}")

    # --- Price-change count ---
    try:
        res = (
            db.table("price_logs")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        overview["price_changes"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Price-change count query failed: {e}")

    # --- OTA coverage breakdown ---
    try:
        res = (
            db.table("price_logs")
            .select("source")
            .gte("created_at", cutoff)
            .execute()
        )
        coverage: Dict[str, int] = {}
        for row in res.data or []:
            src = row.get("source", "unknown")
            coverage[src] = coverage.get(src, 0) + 1
        overview["ota_coverage"] = coverage
    except PostgRESTError as e:
        logger.warning(f"OTA coverage query failed: {e}")

    return overview


async def get_price_trends_logic(
    db: Client,
    hotel_id: Optional[str] = None,
    days: int = 14,
    granularity: str = "day",  # "day" | "hour"
) -> List[Dict[str, Any]]:
    """
    Return price trend data points for charting.
    Optionally scoped to a single hotel.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        query = (
            db.table("price_logs")
            .select("created_at, price, source, room_type")
            .gte("created_at", cutoff)
            .order("created_at")
        )
        if hotel_id:
            query = query.eq("hotel_id", hotel_id)

        res = query.execute()
        rows = res.data or []

        # Group by granularity
        buckets: Dict[str, List[float]] = {}
        for row in rows:
            ts = row.get("created_at", "")
            key = ts[:10] if granularity == "day" else ts[:13]  # YYYY-MM-DD or YYYY-MM-DDTHH
            price = row.get("price")
            if price is not None:
                buckets.setdefault(key, []).append(float(price))

        return [
            {
                "date": k,
                "avg_price": round(sum(v) / len(v), 2),
                "min_price": round(min(v), 2),
                "max_price": round(max(v), 2),
                "sample_count": len(v),
            }
            for k, v in sorted(buckets.items())
        ]
    except PostgRESTError as e:
        logger.warning(f"Price trends DB query failed: {e}")
        return []
    except (ValueError, TypeError) as e:
        logger.warning(f"Price trends data conversion error: {e}")
        return []


async def get_competitor_matrix_logic(
    db: Client,
    hotel_id: str,
) -> Dict[str, Any]:
    """
    Build a competitor pricing matrix for a specific hotel.
    Shows latest prices across OTAs side-by-side.
    """
    try:
        # Get latest prices per source/room_type
        res = (
            db.table("price_logs")
            .select("source, room_type, price, created_at")
            .eq("hotel_id", hotel_id)
            .order("created_at", desc=True)
            .limit(200)
        )
        result = res.execute()
        rows = result.data or []

        # Deduplicate: keep latest per (source, room_type)
        seen: set = set()
        matrix: List[Dict[str, Any]] = []
        for row in rows:
            key = (row.get("source"), row.get("room_type"))
            if key not in seen:
                seen.add(key)
                matrix.append(row)

        return {
            "hotel_id": hotel_id,
            "entries": matrix,
            "sources": list({r.get("source") for r in matrix}),
            "room_types": list({r.get("room_type") for r in matrix}),
        }
    except PostgRESTError as e:
        logger.warning(f"Competitor matrix DB query failed for {hotel_id}: {e}")
        return {"hotel_id": hotel_id, "entries": [], "sources": [], "room_types": []}
    except (KeyError, TypeError) as e:
        logger.warning(f"Competitor matrix data error for {hotel_id}: {e}")
        return {"hotel_id": hotel_id, "entries": [], "sources": [], "room_types": []}


async def get_alert_summary_logic(
    db: Client,
    days: int = 7,
) -> Dict[str, Any]:
    """
    Summarize parity alerts generated in the given window.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        res = (
            db.table("parity_alerts")
            .select("*")
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .execute()
        )
        alerts = res.data or []

        by_severity: Dict[str, int] = {}
        for a in alerts:
            sev = a.get("severity", "info")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "period_days": days,
            "total_alerts": len(alerts),
            "by_severity": by_severity,
            "recent": alerts[:20],
        }
    except PostgRESTError as e:
        logger.warning(f"Alert summary DB query failed: {e}")
        return {
            "period_days": days,
            "total_alerts": 0,
            "by_severity": {},
            "recent": [],
        }
