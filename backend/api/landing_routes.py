from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_admin_user
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["landing"])

class ConfigUpdate(BaseModel):
    locale: str = "tr"
    configs: List[Dict[str, Any]]

@router.get("/landing/config")
async def get_landing_config(locale: str = "tr", db: Client = Depends(get_supabase)):
    """Public endpoint to fetch all landing page configurations for a specific locale."""
    try:
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
            # Final fallback to 'tr' if we still have nothing
            config_dict = {}
        else:
            config_dict = {item["key"]: item["content"] for item in config_data}

        return config_dict
    except Exception as e:
        logger.error(f"Landing config error: {str(e)}")
        # V23: Simplified diagnostic return
        return JSONResponse(status_code=500, content={
            "message": "Landing config failed (V23 Upgrade - SYNCED)", 
            "active_url": str(db.supabase_url) if hasattr(db, 'supabase_url') else "unknown",
            "error_type": type(e).__name__,
            "details": str(e)
        })

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
