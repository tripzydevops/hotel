from fastapi import APIRouter, Depends
from typing import List
from uuid import UUID
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user  # noqa: F401
from backend.models.schemas import Alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/{user_id}", response_model=List[Alert])
async def list_alerts(
    user_id: UUID, unread_only: bool = False, db: Client = Depends(get_supabase)
):
    """
    Fetches the recent price alerts for a specific user.
    Alerts are generated when competitor prices drop below a threshold.
    """
    # EXPLANATION: Alert Service Integration
    # Provides the time-sensitive price drop and competitor undercut events
    # that power the notification bell and Alert Center in the UI.
    if not db:
        return []
    # ... logic ...
    try:
        query = db.table("alerts").select("*").eq("user_id", str(user_id))
        if unread_only:
            query = query.eq("is_read", False)
        result = query.order("created_at", desc=True).limit(50).execute()
        return result.data or []
    except Exception:
        return []


@router.patch("/{alert_id}/read")
async def mark_alert_read(alert_id: UUID, db: Client = Depends(get_supabase)):
    db.table("alerts").update({"is_read": True}).eq("id", str(alert_id)).execute()
    return {"status": "marked_read"}


@router.delete("/user/{user_id}")
async def clear_all_alerts(user_id: UUID, db: Client = Depends(get_supabase)):
    """
    KAİZEN: Operational Hygiene
    Bulk removes all alerts for a specific user. This is preferred over
    soft-deletes (is_read) for performance and storage efficiency.
    """
    try:
        db.table("alerts").delete().eq("user_id", str(user_id)).execute()
        return {"status": "cleared", "user_id": user_id}
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{alert_id}")
async def delete_alert(alert_id: UUID, db: Client = Depends(get_supabase)):
    """Removes a single alert by ID."""
    db.table("alerts").delete().eq("id", str(alert_id)).execute()
    return {"status": "deleted", "alert_id": alert_id}
