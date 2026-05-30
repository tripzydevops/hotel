"""
Security utilities for Hotel Rate Monitor.
Enforces resource ownership and prevents ID harvesting.

This module provides:
    - verify_ownership(): Low-level check for user-to-resource identity match.
    - verify_hotel_ownership(): Async check that a user owns a hotel via user_hotels table.
    - verify_scan_session_ownership(): Async check that a scan session belongs to a user.
"""

from typing import Any

from fastapi import HTTPException

from backend.utils.logger import get_logger

logger = get_logger(__name__)


def verify_ownership(
    resource_user_id: Any, current_user: Any, admin_bypass: bool = True
):
    """
    Verify that the resource belongs to the current user.
    Supports admin bypass if requested.
    """
    try:
        current_uid = str(current_user.id)
        target_uid = str(resource_user_id)

        if current_uid == target_uid:
            return True

        # Admin Bypass Logic
        if admin_bypass:
            # Check for admin role in user metadata or profiles
            role = getattr(
                current_user, "role", None
            ) or current_user.user_metadata.get("role", "user")
            if role in ["admin", "market_admin", "market admin"]:
                return True

        raise HTTPException(
            status_code=403, detail="Forbidden: Resource ownership mismatch"
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=403, detail="Forbidden: Ownership verification failed"
        )


async def verify_hotel_ownership(
    db: Any, user_id: str, hotel_id: str, admin_bypass: bool = True
) -> None:
    """
    Reusable IDOR guard: Raises HTTP 403 if the user does not own the hotel.
    Uses the many-to-many user_hotels mapping table for verification.
    Admins bypass the check when admin_bypass=True.

    This is the canonical function that should be called from any route
    that accepts a hotel_id parameter and needs to enforce tenant isolation.
    """
    try:
        # 1. Admin Bypass
        if admin_bypass:
            profile_res = (
                db.table("user_profiles")
                .select("role")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            if profile_res.data and profile_res.data.get("role") in [
                "admin",
                "market_admin",
                "market admin",
            ]:
                return

        # 2. Many-to-Many Mapping Check
        res = (
            db.table("user_hotels")
            .select("user_id")
            .eq("user_id", str(user_id))
            .eq("hotel_id", str(hotel_id))
            .execute()
        )
        if len(res.data or []) > 0:
            return

        logger.warning(
            f"IDOR blocked: user {user_id} attempted to access hotel {hotel_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: You do not have access to this hotel",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hotel ownership check failed for hotel {hotel_id}: {e}")
        raise HTTPException(
            status_code=403,
            detail="Ownership verification failed",
        )


async def verify_scan_session_ownership(
    db: Any, user_id: str, session_id: str
) -> None:
    """
    Verifies that a scan session belongs to the authenticated user
    by checking that the session's hotel_id is owned by the user.
    Raises HTTP 403 on failure, HTTP 404 if the session doesn't exist.
    """
    try:
        session_res = (
            db.table("scan_sessions")
            .select("hotel_id, user_id")
            .eq("id", str(session_id))
            .maybe_single()
            .execute()
        )
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Direct user_id match on the session itself
        session_user = session_res.data.get("user_id")
        if session_user and str(session_user) == str(user_id):
            return

        # Fallback: check hotel ownership
        session_hotel = session_res.data.get("hotel_id")
        if session_hotel:
            await verify_hotel_ownership(db, user_id, str(session_hotel))
            return

        raise HTTPException(
            status_code=403, detail="Unauthorized: Session access denied"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session ownership check failed for {session_id}: {e}")
        raise HTTPException(
            status_code=403, detail="Session ownership verification failed"
        )
