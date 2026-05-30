"""
Report Service
==============
User-scoped report retrieval and CSV export.

Extracted from admin_service.py — these are NOT admin-only functions.
They serve the user-facing /api/reports endpoints.
"""

import csv
import io
from typing import Any, Dict, List
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from supabase import Client

from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_reports_logic(user_id: UUID, db: Client) -> JSONResponse:
    """Fetch data for user-facing report listing."""
    try:
        # 1. Fetch Scan Sessions (Traditional reports)
        sessions_res = (
            db.table("scan_sessions")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        raw_sessions: List[Dict[str, Any]] = list(sessions_res.data or [])  # type: ignore[arg-type]
        sessions = [
            s for s in raw_sessions if (s.get("hotels_count") or 0) > 0
        ]

        # 2. Fetch Agentic Briefings (Phase 4 saved reports)
        briefings_res = (
            db.table("reports")
            .select("id, title, report_type, created_at, created_by")
            .eq("report_type", "briefing")
            .or_(f"created_by.eq.{user_id},created_by.is.null")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        briefings: List[Dict[str, Any]] = list(briefings_res.data or [])  # type: ignore[arg-type]

        summary = {
            "total_scans": len(sessions),
            "total_briefings": len(briefings),
            "system_health": "100%",
        }

        return JSONResponse(
            content=jsonable_encoder(
                {
                    "sessions": sessions,
                    "briefings": briefings,
                    "weekly_summary": summary,
                }
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def export_report_logic(user_id: UUID, format: str, db: Client) -> Any:
    """Export report data as CSV."""
    if format != "csv":
        return {"status": "error", "message": "Only CSV supported"}

    raw_mapping: List[Dict[str, Any]] = list(  # type: ignore[arg-type]
        db.table("user_hotels")
        .select("hotel_id, hotels(id, name)")
        .eq("user_id", str(user_id))
        .execute()
        .data
        or []
    )
    hotel_map: Dict[str, str] = {}
    for m in raw_mapping:
        h = m.get("hotels")
        if isinstance(h, dict):
            hotel_map[str(h["id"])] = str(h["name"])

    hotel_ids = list(hotel_map.keys())

    raw_logs: List[Dict[str, Any]] = list(  # type: ignore[arg-type]
        db.table("price_logs")
        .select("*")
        .in_("hotel_id", hotel_ids)
        .order("recorded_at", desc=True)
        .limit(1000)
        .execute()
        .data
        or []
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Hotel", "Price", "Currency"])
    for entry in raw_logs:
        writer.writerow(
            [
                entry["recorded_at"],
                hotel_map.get(str(entry["hotel_id"]), "Unknown"),
                entry["price"],
                entry.get("currency", "USD"),
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{user_id}.csv"},
    )
