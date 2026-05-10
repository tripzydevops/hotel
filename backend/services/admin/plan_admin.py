"""
Admin — Membership Plan Management
=====================================
Handles CRUD operations for membership/subscription plans.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from typing import Any, Dict, List
from uuid import UUID

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.models.schemas import PlanCreate, PlanUpdate
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_admin_plans_logic(db: Client) -> List[Dict[str, Any]]:
    """List all available membership plans."""
    try:
        res = db.table("membership_plans").select("*").order("price_monthly").execute()
        return res.data or []
    except PostgRESTError as e:
        logger.warning(f"Membership plans DB query failed (using defaults): {e}")
        # Fallback to defaults if table doesn't exist yet
        return [
            {"id": "starter", "name": "Starter", "price_monthly": 49, "hotel_limit": 5},
            {"id": "pro", "name": "Pro", "price_monthly": 149, "hotel_limit": 25},
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price_monthly": 399,
                "hotel_limit": 999,
            },
        ]


async def create_admin_plan_logic(plan: PlanCreate, db: Client) -> Dict[str, Any]:
    """Create a new membership plan."""
    try:
        data = plan.model_dump()
        res = db.table("membership_plans").insert(data).execute()
        return res.data[0] if res.data else {"status": "success"}
    except PostgRESTError as e:
        logger.error(f"PostgREST error creating plan: {e}", exc_info=True)
        raise HTTPException(500, f"Database error: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data error creating plan: {e}", exc_info=True)
        raise HTTPException(400, f"Invalid plan data: {e}")


async def update_admin_plan_logic(
    id: UUID, plan: PlanUpdate, db: Client
) -> Dict[str, Any]:
    """Update an existing membership plan."""
    try:
        data = plan.model_dump(exclude_unset=True)
        res = db.table("membership_plans").update(data).eq("id", str(id)).execute()
        return res.data[0] if res.data else {"status": "success"}
    except PostgRESTError as e:
        logger.error(f"PostgREST error updating plan {id}: {e}", exc_info=True)
        raise HTTPException(500, f"Database error: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Data error updating plan {id}: {e}", exc_info=True)
        raise HTTPException(400, f"Invalid plan data: {e}")


async def delete_admin_plan_logic(id: UUID, db: Client) -> Dict[str, Any]:
    """Delete a membership plan."""
    try:
        db.table("membership_plans").delete().eq("id", str(id)).execute()
        return {"status": "success"}
    except PostgRESTError as e:
        logger.error(f"PostgREST error deleting plan {id}: {e}", exc_info=True)
        raise HTTPException(500, f"Database error: {e}")


async def delete_plan_logic(db: Client, plan_id: UUID) -> bool:
    """Delete a plan."""
    try:
        db.table("membership_plans").delete().eq("id", str(plan_id)).execute()
        return True
    except PostgRESTError as e:
        logger.error(f"PostgREST error deleting plan {plan_id}: {e}", exc_info=True)
        return False
