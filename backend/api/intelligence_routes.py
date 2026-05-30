"""
Intelligence Routes — v1 endpoints for:
  - Proactive alert evaluation (Features 2b)
  - Revenue impact from sentiment (Feature 3b)
  - What-If scenario modeling (Feature 4b)
  - Collaborative annotations (Feature 6b)
"""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import Client

from backend.services.auth_service import get_current_active_user, get_supabase_rls

router = APIRouter(tags=["intelligence-v1"])


# ---------------------------------------------------------------------------
# Ownership check helper
# ---------------------------------------------------------------------------

async def _verify_hotel_owner(db: Client, user_id: str, hotel_id: str) -> None:
    from backend.services.analysis_service import check_hotel_ownership
    if not await check_hotel_ownership(db, user_id, hotel_id):
        raise HTTPException(status_code=403, detail="Unauthorized: You do not own this hotel")


# ===========================================================================
# Feature 2b — Proactive Alert Evaluation
# ===========================================================================

@router.post("/v1/alerts/evaluate/{hotel_id}", response_model=Dict[str, Any])
async def evaluate_proactive_alerts(
    hotel_id: str,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Proactive Alert Evaluation (7.3).
    Evaluates margin erosion, rate opportunities, and OTA parity violations
    for the given hotel.  Persists new alerts and returns them.

    Called automatically post-scan and on-demand from the alerts panel.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)
    await _verify_hotel_owner(db, user_id, hotel_id)

    try:
        from backend.services.proactive_alert_service import evaluate_proactive_alerts
        alerts = await evaluate_proactive_alerts(db, user_id, hotel_id)
        return {"alerts": jsonable_encoder(alerts), "count": len(alerts)}
    except Exception as e:
        raise HTTPException(500, str(e))


# ===========================================================================
# Feature 3b — Revenue Impact from Sentiment
# ===========================================================================

@router.get("/v1/analysis/revenue-impact/{hotel_id}", response_model=Dict[str, Any])
async def get_revenue_impact(
    hotel_id: str,
    db: Client = Depends(get_supabase_rls),
    admin_db: Client = Depends(__import__('backend.services.auth_service', fromlist=['get_supabase_admin']).get_supabase_admin),
    current_user=Depends(get_current_active_user),
):
    """
    Predictive Revenue Impact from Sentiment (7.2).
    Estimates the monthly revenue impact of recent sentiment score changes.
    Example: "Your cleanliness score dropped 0.4 pts → estimated ₺8,200/month loss"
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)
    await _verify_hotel_owner(db, user_id, hotel_id)

    try:
        from backend.services.revenue_impact_service import calculate_sentiment_revenue_impact
        result = await calculate_sentiment_revenue_impact(db, hotel_id)
        return JSONResponse(content=jsonable_encoder(result))
    except Exception as e:
        raise HTTPException(500, str(e))


# ===========================================================================
# Feature 4b — What-If Scenario Modeling
# ===========================================================================

class WhatIfRequest(BaseModel):
    hotel_id: str
    scenario: str  # Free-text scenario description


@router.post("/v1/analysis/whatif", response_model=Dict[str, Any])
async def simulate_whatif(
    body: WhatIfRequest,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    AI What-If Scenario Modeling (7.5).
    Simulates the market impact of a pricing or strategy change.
    Returns structured predictions with occupancy impact, revenue delta,
    competitor reactions, and risk level.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)
    await _verify_hotel_owner(db, user_id, body.hotel_id)

    if not body.scenario or len(body.scenario.strip()) < 10:
        raise HTTPException(400, "Scenario description must be at least 10 characters")

    try:
        from backend.services.whatif_service import simulate_whatif_scenario
        result = await simulate_whatif_scenario(
            db=db,
            user_id=user_id,
            hotel_id=body.hotel_id,
            scenario=body.scenario,
        )
        return JSONResponse(content=jsonable_encoder(result))
    except Exception as e:
        raise HTTPException(500, str(e))


# ===========================================================================
# Feature 6b — Collaborative Hotel Annotations
# ===========================================================================

class AnnotationRequest(BaseModel):
    note: str
    annotation_type: Optional[str] = "general"  # general | decision | question | risk


@router.get("/v1/hotels/{hotel_id}/annotations", response_model=List[Dict[str, Any]])
async def get_annotations(
    hotel_id: str,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Get all annotations for a hotel (visible to all team members)."""
    if not db:
        raise HTTPException(503, "Database unavailable")

    await _verify_hotel_owner(db, str(current_user.id), hotel_id)

    try:
        res = (
            db.table("hotel_annotations")
            .select("*, user_profiles(display_name, avatar_url)")
            .eq("hotel_id", hotel_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/v1/hotels/{hotel_id}/annotations", response_model=Dict[str, Any])
async def add_annotation(
    hotel_id: str,
    body: AnnotationRequest,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Add a new annotation to a hotel."""
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)
    await _verify_hotel_owner(db, user_id, hotel_id)

    if not body.note or len(body.note.strip()) < 3:
        raise HTTPException(400, "Annotation note must be at least 3 characters")

    try:
        from datetime import datetime, timezone
        res = (
            db.table("hotel_annotations")
            .insert({
                "hotel_id": hotel_id,
                "user_id": user_id,
                "note": body.note.strip(),
                "annotation_type": body.annotation_type or "general",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            .execute()
        )
        return res.data[0] if res.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/v1/hotels/{hotel_id}/annotations/{annotation_id}", response_model=Dict[str, Any])
async def delete_annotation(
    hotel_id: str,
    annotation_id: str,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Delete an annotation (only by original author)."""
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)

    try:
        # Verify ownership of the annotation itself (not just the hotel)
        existing = (
            db.table("hotel_annotations")
            .select("user_id")
            .eq("id", annotation_id)
            .single()
            .execute()
        )
        if not existing.data:
            raise HTTPException(404, "Annotation not found")
        if existing.data["user_id"] != user_id:
            raise HTTPException(403, "You can only delete your own annotations")

        db.table("hotel_annotations").delete().eq("id", annotation_id).execute()
        return {"status": "deleted", "id": annotation_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/v1/hotels/{hotel_id}/annotations/meeting-prep", response_model=Dict[str, Any])
async def generate_meeting_prep(
    hotel_id: str,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Collaborative Intelligence: AI Meeting Prep (7.6).
    Synthesizes recent annotations + market data into a concise meeting brief.
    """
    if not db:
        raise HTTPException(503, "Database unavailable")

    user_id = str(current_user.id)
    await _verify_hotel_owner(db, user_id, hotel_id)

    try:
        # Fetch recent annotations
        ann_res = (
            db.table("hotel_annotations")
            .select("note, annotation_type, created_at")
            .eq("hotel_id", hotel_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        annotations = ann_res.data or []

        # Fetch hotel name
        hotel_res = db.table("hotels").select("name").eq("id", hotel_id).single().execute()
        hotel_name = hotel_res.data.get("name", "Your Hotel") if hotel_res.data else "Your Hotel"

        if not annotations:
            return {
                "brief": f"No annotations found for {hotel_name}. Add team notes first.",
                "action_items": [],
                "risks": [],
            }

        # Generate brief with Gemini
        import os
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"brief": "AI service unavailable.", "action_items": [], "risks": []}

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        annotations_text = "\n".join(
            f"- [{a.get('annotation_type','note').upper()}] {a['note']}"
            for a in annotations
        )

        prompt = f"""
You are preparing a 5-minute revenue meeting brief for {hotel_name}.

Recent team annotations:
{annotations_text}

Generate a concise meeting prep brief in JSON:
{{
  "brief": "2-3 sentence executive summary",
  "action_items": ["specific action 1", "specific action 2"],
  "risks": ["risk 1", "risk 2"],
  "decisions_needed": ["decision 1"]
}}
"""
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_mime_type="application/json"),
        )
        return json.loads(response.text)

    except Exception as e:
        raise HTTPException(500, str(e))
