from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
# from supabase import Client (moved to function scope)
# from backend.utils.db import get_supabase (moved to function scope)
from backend.services.auth_service import get_current_admin_user
from backend.utils.logger import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["landing"])

class ConfigUpdate(BaseModel):
    locale: str = "tr"
    configs: List[Dict[str, Any]]

@router.get("/landing/config")
async def get_landing_config(locale: str = "tr"):
    """Public endpoint to fetch all landing page configurations for a specific locale."""
    try:
        from backend.utils.db import get_supabase
        db = get_supabase()
        
        if not db:
            print("DB_RECOVERY: Database client unavailable. Returning fallback configuration.")
            return LandingConfigResponse(
                hero_title=HERO_TITLE_FALLBACK,
                hero_subtitle=HERO_SUBTITLE_FALLBACK,
                sections=[]
            )
        # V23 cascading logic:
        # Try full locale (e.g., 'tr-TR'), then base part (e.g., 'tr'), then default 'tr'.
        target_locales = [locale]
        if "-" in locale:
            target_locales.append(locale.split("-")[0])
        
        # Ensure we always have 'tr' as the ultimate fallback in Turkish-first projects
        if "tr" not in target_locales:
            target_locales.append("tr")
        
        # Try finding config for these locales in order
        config_data = []
        for loc in target_locales:
            res = (
                db.table("landing_page_config")
                .select("key, content")
                .eq("locale", loc)
                .execute()
            )
            if res.data and len(res.data) > 0:
                config_data = res.data
                break

        if not config_data:
            # V24 FALLBACK: Hardcoded defaults for a premium hotel experience if DB is empty
            config_dict = {
                "hero": {
                    "title": "Welcome to Your Premium Stay",
                    "subtitle": "Luxury, Comfort, and Elegance redefined for the modern traveler.",
                    "cta": "Book Now"
                },
                "features": [
                    {"title": "Spa & Wellness", "description": "Relax in our state-of-the-art wellness centers."},
                    {"title": "Gourmet Dining", "description": "Exquisite cuisines prepared by world-renowned chefs."},
                    {"title": "Smart Rooms", "description": "Control your entire room with one touch."}
                ],
                "about": {
                    "title": "Our History",
                    "content": "Founded with a vision of luxury, we provide unparalleled service since 1995."
                }
            }
            logger.info(f"AUDIT: Using hardcoded landing config defaults for {locale}")
        else:
            config_dict = {item["key"]: item["content"] for item in config_data}

        return config_dict
    except Exception as e:
        logger.error(f"Landing config error: {str(e)}")
        # V24 Fallback: Return a valid JSON even in case of total failure
        return {
            "hero": {"title": "Elegant Stays (Offline Mode)", "subtitle": "Connection to theme data temporarily interrupted."},
            "status": "partial_offline",
            "error_hint": type(e).__name__
        }

@router.get("/admin/landing/config")
async def get_admin_landing_config(
    locale: str = "tr",
    current_user: dict = Depends(get_current_admin_user),
):
    from backend.utils.db import get_supabase
    db = get_supabase()
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
):
    from backend.utils.db import get_supabase
    db = get_supabase()
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
