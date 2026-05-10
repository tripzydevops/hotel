"""
Admin — Hotel & Directory Management
======================================
Handles hotel CRUD, directory listing, search, and entry management.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.models.schemas import AdminDirectoryEntry
from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def search_admin_directory_logic(db: Client, q: str) -> List[Dict[str, Any]]:
    """
    Search directory with admin privileges.
    """
    try:
        res = db.table("hotel_directory").select("*").ilike("name", f"%{q}%").execute()
        return res.data or []
    except PostgRESTError as e:
        logger.error(f"PostgREST error searching directory for '{q}': {e}", exc_info=True)
        return []
    except (KeyError, TypeError) as e:
        logger.warning(f"Data error in directory search for '{q}': {e}")
        return []


async def get_admin_directory_logic(
    db: Client, limit: int = 100, city: Optional[str] = None
) -> List[AdminDirectoryEntry]:
    """List directory entries."""
    query = (
        db.table("hotel_directory")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if city:
        query = query.ilike("location", f"%{city}%")
    result = query.execute()
    entries = []
    for item in result.data or []:
        entries.append(
            AdminDirectoryEntry(
                id=item["id"],
                name=item["name"],
                location=item["location"] or "Unknown",
                property_token=item.get("property_token"),
                created_at=item["created_at"],
            )
        )
    return entries


async def add_admin_directory_entry_logic(entry: dict, db: Client) -> Dict[str, Any]:
    """Add a directory entry manually."""
    try:
        db.table("hotel_directory").insert(
            {
                "name": entry["name"],
                "location": entry["location"],
                "property_token": entry.get("property_token"),
            }
        ).execute()
        return {"status": "success"}
    except KeyError as e:
        logger.warning(f"Missing required field in directory entry: {e}")
        raise HTTPException(status_code=400, detail=f"Missing required field: {e}")
    except PostgRESTError as e:
        logger.error(f"PostgREST error adding directory entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


async def delete_admin_directory_logic(entry_id: str, db: Client) -> Dict[str, Any]:
    """Delete a directory entry."""
    try:
        db.table("hotel_directory").delete().eq("id", entry_id).execute()
        return {"status": "success"}
    except PostgRESTError as e:
        logger.error(f"PostgREST error deleting directory entry {entry_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


async def update_admin_directory_logic(
    entry_id: str, updates: dict, db: Client
) -> Dict[str, Any]:
    """Update a directory entry."""
    try:
        update_data = {
            k: v
            for k, v in updates.items()
            if k in ["name", "location", "property_token"]
        }
        if update_data:
            db.table("hotel_directory").update(update_data).eq("id", entry_id).execute()
        return {"status": "success", "id": entry_id}
    except PostgRESTError as e:
        logger.error(f"PostgREST error updating directory entry {entry_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


async def get_admin_hotels_logic(db: Client, limit: int = 100) -> List[Dict[str, Any]]:
    """List all registered properties with detailed user ownership info."""
    hotels = db.table("hotels").select("*").limit(limit).execute().data or []

    # Fetch all mappings to identify who owns what capacity
    mappings = (
        db.table("user_hotels").select("hotel_id, user_id, is_target").execute().data
        or []
    )

    # Fetch all profiles to show human-readable names/emails
    profiles = (
        db.table("user_profiles").select("user_id, email, display_name").execute().data
        or []
    )
    profile_map = {str(p["user_id"]): p for p in profiles}

    # Group mappings by hotel
    hotel_user_map = {}
    for m in mappings:
        hid = str(m["hotel_id"])
        if hid not in hotel_user_map:
            hotel_user_map[hid] = []

        prof = profile_map.get(str(m["user_id"]), {})
        hotel_user_map[hid].append(
            {
                "user_id": m["user_id"],
                "email": prof.get("email"),
                "display_name": prof.get("display_name"),
                "is_target": m.get("is_target", False),
                "role": "target" if m.get("is_target") else "competitor",
            }
        )

    results = []
    for h in hotels:
        hid = str(h["id"])
        user_list = hotel_user_map.get(hid, [])
        results.append(
            {
                "id": h["id"],
                "name": h["name"],
                "location": h["location"],
                "user_count": len(user_list),
                "users": user_list,
                "property_token": h.get("property_token"),
                "created_at": h["created_at"],
            }
        )
    return results


async def update_admin_hotel_logic(
    hotel_id: str, updates: dict, db: Client
) -> Dict[str, Any]:
    """Update hotel details via Admin API."""
    allowed = [
        "name",
        "location",
        "property_token",
        "is_target_hotel",
        "preferred_currency",
        "rating",
        "stars",
    ]
    update_data = {k: v for k, v in updates.items() if k in allowed}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.table("hotels").update(update_data).eq("id", hotel_id).execute()
    return {"status": "success", "hotel_id": hotel_id}


async def delete_admin_hotel_logic(hotel_id: str, db: Client) -> Dict[str, Any]:
    """Delete hotel but PRESERVE price_logs for historical data."""
    # SAFEGUARD: Price logs are NOT deleted.
    # Historical pricing data is valuable and should persist even if the hotel
    # is removed. If the hotel is re-added later, the data reconnects via hotel_id.
    db.table("alerts").delete().eq("hotel_id", hotel_id).execute()
    db.table("hotels").delete().eq("id", hotel_id).execute()
    return {"status": "success"}
