"""
Signal Ingestion Route — B2B Product Intelligence Telemetry
Receives batched dashboard interaction signals from useSignalBuffer,
stores them in user_signals, and optionally triggers background processing.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from supabase import Client

from backend.api.models import BatchSignalRequest, BatchSignalResponse
from backend.services.auth_service import get_current_active_user, get_supabase_rls

router = APIRouter(prefix="/signals", tags=["signals"])


@router.post("/batch", response_model=BatchSignalResponse)
async def ingest_signals(
    payload: BatchSignalRequest,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Batch signal ingestion endpoint.

    Receives up to 100 dashboard interaction signals per call from the
    useSignalBuffer React hook.  Signals are stored in user_signals and
    the CompsetIntelligenceAgent is scheduled as a background task when
    the user has accumulated enough events (≥ 5 within the last hour).

    Signal types expected:
    - competitor_click / competitor_expand / competitor_tab_selected
    - alert_investigated / alert_dismissed
    - dwell_time / view / click
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    user_id = str(current_user.id)
    signals = payload.signals
    session_id = payload.session_id

    if not signals:
        return BatchSignalResponse(success=True, count=0)

    # Build rows for bulk insert
    rows: List[Dict[str, Any]] = [
        {
            "user_id": user_id,
            "session_id": session_id,
            "signal_type": sig.signal_type,
            "payload": sig.payload,
            "created_at": sig.timestamp,  # preserve client-side timestamp
        }
        for sig in signals
    ]

    try:
        db.table("user_signals").insert(rows).execute()
    except Exception as e:
        # Non-fatal: return warning instead of 500 so frontend stays healthy
        return BatchSignalResponse(
            success=False,
            count=0,
            warning=f"Signal storage degraded: {str(e)[:120]}",
        )

    # Schedule background compset profile rebuild (fire-and-forget)
    background_tasks.add_task(_maybe_rebuild_compset, user_id)

    return BatchSignalResponse(success=True, count=len(rows))


async def _maybe_rebuild_compset(user_id: str) -> None:
    """
    Background task: rebuild the compset profile if the user has
    accumulated ≥ 5 new signals within the last hour.
    Runs asynchronously so it never blocks the signal ingestion response.
    """
    try:
        from backend.agents.signal_processor import process_pending_signals
        await process_pending_signals()
    except Exception as e:
        # Fully non-fatal background task
        import logging
        logging.getLogger(__name__).warning(
            f"Background compset rebuild skipped for {user_id}: {e}"
        )
