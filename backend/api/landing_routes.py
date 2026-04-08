from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_admin_user
from backend.utils.logger import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)

# EXPLANATION: Routing & Query Normalization (Regression Fix)
# 1. Removed "/api" prefix from APIRouter to avoid doubled paths 
#    (e.g., /api/api/landing/config) when registered in main.py.
# 2. Fixed query in get_landing_config by removing invalid .eq("status", "active") 
#    filter as the landing_page_config table does not contain a status column.
router = APIRouter(tags=["landing"])

class ConfigUpdate(BaseModel):
    locale: str = "tr"
    configs: List[Dict[str, Any]]

@router.get("/landing/config")
async def get_landing_config(locale: str = "tr", db: Client = Depends(get_supabase)):
    """
    KAIZEN: Ultra-fast landing page config delivery.
    Fetches marketing text and CTA anchors for the specified locale.
    """
    config_data = []
    # Support for fallback to 'en' if 'tr' is missing
    target_locales = [locale]
    if locale != "en":
        target_locales.append("en")

    try:
        # Check if database is initialized
        if not db:
            raise Exception("Database client not available")

        for loc in target_locales:
            res = (
                db.table("landing_page_config")
                .select("key, content")
                .eq("locale", loc)
                .execute()
            )
            # Robust check for data (APIResponse object or list if older SDK)
            data = getattr(res, "data", None)
            if data is None and isinstance(res, list):
                data = res

            if data and len(data) > 0:
                config_data = data
                break

        if not config_data:
            # V24 FALLBACK: Hardcoded defaults if DB is empty or unreachable
            config_dict = {
                "hero": {
                    "title": "HotelPlus: Autonomous Intelligence",
                    "subtitle": "Offline Mode Active",
                    "cta": "Get Started",
                },
                "features": [],
                "status": "partial_offline",
            }
        else:
            # Process DB rows into a dictionary
            # Row format: {"key": "hero", "content": {...}}
            config_dict = {item.get("key"): item.get("content") for item in config_data if item.get("key")}
            config_dict["status"] = "online"

        return config_dict

    except Exception as e:
        logger.error(f"Landing config error: {str(e)}", exc_info=True)
        return {
            "hero": {
                "title": "HotelPlus TR",
                "subtitle": f"Service temporarily unavailable: {type(e).__name__}",
                "cta": "Retry",
            },
            "status": "error",
            "error_hint": str(e),
        }

@router.get("/admin/landing/config")
async def get_admin_landing_config(
    locale: str = "tr",
    current_user: dict = Depends(get_current_admin_user),
    db: Client = Depends(get_supabase),
):
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
    try:
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
