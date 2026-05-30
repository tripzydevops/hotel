
from backend.models.schemas import SuccessResponse
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.models.schemas import Alert
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from supabase import Client

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[Alert])
async def list_alerts(
    unread_only: bool = False,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Fetches the recent price alerts for the current user.
    """
    user_id = current_user.id

    try:
        query = db.table("alerts").select("*").eq("user_id", str(user_id))
        if unread_only:
            query = query.eq("is_read", False)
        result = query.order("created_at", desc=True).limit(50).execute()
        return result.data or []
    except Exception:
        return []


@router.patch("/{alert_id}/read", response_model=SuccessResponse)
async def mark_alert_read(
    alert_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    # KAIZEN: Ownership Verification for specific resource
    try:
        current_res = (
            db.table("alerts")
            .select("user_id")
            .eq("id", str(alert_id))
            .single()
            .execute()
        )
        if not current_res.data:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Alert not found")

        from backend.utils.security import verify_ownership

        verify_ownership(current_res.data["user_id"], current_user)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="Ownership check failed")

    db.table("alerts").update({"is_read": True}).eq("id", str(alert_id)).execute()
    return {"status": "marked_read"}


@router.delete("/user", response_model=SuccessResponse)
async def clear_all_alerts(
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    KAİZEN: Operational Hygiene
    Bulk removes all alerts for the current user.
    """
    user_id = current_user.id

    try:
        db.table("alerts").delete().eq("user_id", str(user_id)).execute()
        return {"status": "cleared", "user_id": user_id}
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{alert_id}", response_model=SuccessResponse)
async def delete_alert(
    alert_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """Removes a single alert by ID."""
    # KAIZEN: Ownership Verification
    try:
        current_res = (
            db.table("alerts")
            .select("user_id")
            .eq("id", str(alert_id))
            .single()
            .execute()
        )
        if not current_res.data:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Alert not found")

        from backend.utils.security import verify_ownership

        verify_ownership(current_res.data["user_id"], current_user)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="Ownership check failed")

    db.table("alerts").delete().eq("id", str(alert_id)).execute()
    return {"status": "deleted", "alert_id": alert_id}
