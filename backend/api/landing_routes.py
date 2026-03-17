"""
EXPLANATION: Landing Page API Routes

Handles public and admin endpoints for the Landing Page CMS.
Supports multi-language content fetching and upserting via the 'locale' dimension.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_admin_user
from pydantic import BaseModel
from backend.utils.logger import get_logger
logger = get_logger(__name__)

router = APIRouter(prefix="/api/landing", tags=["landing"])


class ConfigUpdate(BaseModel):
    locale: str = "tr"
    configs: List[Dict[str, Any]]  # List of {"key": "...", "content": {...}}


@router.get("/landing/config")
async def get_landing_config(locale: str = "tr", db: Optional[Client] = Depends(get_supabase)):
    """Public endpoint to fetch all landing page configurations for a specific locale."""
    try:
        if not db:
            logger.error("Landing: Database client not available")
            return {}

        res = (
            db.table("landing_page_config")
            .select("key, content")
            .eq("locale", locale)
            .execute()
        )
        
        # Convert list of {key, content} to dict {key: content} for easier frontend use
        if not res or not res.data:
            logger.warning(f"Landing: No config found for locale={locale}")
            return {}

        config_dict = {item["key"]: item["content"] for item in res.data}
        return config_dict
    except Exception as e:
        logger.error(f"Landing: CRITICAL FAILURE: {str(e)}")
        # Return empty dict instead of 500 to keep the page partially functional
        return {}


@router.get("/admin/landing/config")
async def get_admin_landing_config(
    locale: str = "tr",
    current_user: dict = Depends(get_current_admin_user),
    db: Client = Depends(get_supabase),
):
    """Admin endpoint to fetch raw configuration for editing."""
    try:
        res = (
            db.table("landing_page_config")
            .select("*")
            .eq("locale", locale)
            .order("key")
            .execute()
        )
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/landing/config")
async def update_landing_config(
    data: ConfigUpdate,
    current_user: dict = Depends(get_current_admin_user),
    db: Client = Depends(get_supabase),
):
    """Admin endpoint to update multiple configuration keys at once."""
    try:
        # Perform upserts for each config item
        for item in data.configs:
            db.table("landing_page_config").upsert(
                {"key": item["key"], "locale": data.locale, "content": item["content"]},
                on_conflict="key,locale",
            ).execute()

        return {
            "status": "success",
            "message": f"Updated {len(data.configs)} sections ({data.locale})",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
