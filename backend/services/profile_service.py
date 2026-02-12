"""
Profile Service
Handles business logic for user profiles, including plan enrichment and admin bypasses.
"""

import os
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional, Dict, Any
from fastapi import HTTPException
from supabase import Client, create_client
from backend.models.schemas import UserProfile, UserProfileUpdate

async def get_enriched_profile_logic(user_id: UUID, base_data: Optional[Dict[str, Any]], db: Client) -> Dict[str, Any]:
    """
    Enriches profile data with subscription status and admin bypass rules.
    
    Why: We separate 'user_profiles' (metadata) from 'profiles' (auth/plan truth) 
    to handle complex enterprise/admin overrides without polluting the primary metadata table.
    """
    user_id_str = str(user_id)
    is_dev_user = user_id_str == "123e4567-e89b-12d3-a456-426614174000"
    
    # 1. Fetch subscription info (truth source) from the auth profiles table
    # We use the Service Role key here because standard RLS might block 
    # cross-user lookups even for enrichment logic.
    admin_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    
    plan = "trial"
    status = "trial"
    bypass_active = False
    sub_data = []

    try:
        viewer_db = db
        if admin_key and url:
             viewer_db = create_client(url, admin_key)
        
        result = viewer_db.table("profiles").select("plan_type, subscription_status").eq("id", user_id_str).execute()
        sub_data = result.data
    except Exception as e:
        print(f"Profile Sync Error: {e}")
    
    if sub_data:
        plan = sub_data[0].get("plan_type") or "trial"
        status = sub_data[0].get("subscription_status") or "trial"
    
    # 2. Admin Bypass Logic: Force Enterprise if user is a known admin or has a specific ID
    # This ensures internal staff always has full platform access.
    try:
        specific_admin_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a"
        is_specific_admin = user_id_str == specific_admin_id
        
        if admin_key and url:
            admin_db = create_client(url, admin_key)
            admin_email_found = None
            try:
                user_auth = admin_db.auth.admin.get_user_by_id(user_id_str)
                if user_auth and user_auth.user:
                    admin_email_found = user_auth.user.email
            except Exception:
                pass
            
            is_admin_email = admin_email_found and (
                admin_email_found in ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com", "yusuf@tripzy.travel"] 
                or admin_email_found.endswith("@hotel.plus")
            )
            
            is_admin_role = base_data and base_data.get("role") in ["admin", "market_admin", "market admin"]
                
            if is_admin_email or is_admin_role or is_specific_admin:
                plan = "enterprise"
                status = "active"
                bypass_active = True

        elif is_specific_admin:
            plan = "enterprise"
            status = "active"
            bypass_active = True
    except Exception as e:
        print(f"[Profile] Bypass Logic Error: {e}")

    # 3. Fallback to base_data if subscription lookup failed or returned trial
    if (not sub_data or plan == "trial") and base_data:
        if not bypass_active:
            plan = base_data.get("plan_type") or plan
            status = base_data.get("subscription_status") or status

    # 4. Force Enterprise for Development/Testing User
    if is_dev_user:
        plan = "enterprise"
        status = "active"
        bypass_active = True

    # Final Merge: Take base profile metadata and inject calculated plan status
    profile_result: Dict[str, Any] = base_data.copy() if base_data else {"user_id": user_id_str}
    profile_result["plan_type"] = plan
    profile_result["subscription_status"] = status
    profile_result["is_admin_bypass"] = bypass_active
    
    # Ensure timestamps exist for model validation
    if "created_at" not in profile_result: 
        profile_result["created_at"] = datetime.now(timezone.utc).isoformat()
    if "updated_at" not in profile_result: 
        profile_result["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    return profile_result

async def update_profile_logic(user_id: UUID, profile: UserProfileUpdate, db: Client) -> Dict[str, Any]:
    """
    Handles the 'upsert' logic for user profiles.
    
    Why: Not all users have a 'user_profiles' entry immediately on signup.
    This logic ensures a record is created or updated seamlessly.
    """
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    user_id_str = str(user_id)
    
    # Upsert logic: Check existence first to avoid Supabase insert conflicts where possible
    existing = db.table("user_profiles").select("user_id").eq("user_id", user_id_str).execute()
    
    if not existing.data:
        result = db.table("user_profiles").insert({"user_id": user_id_str, **update_data}).execute()
    else:
        result = db.table("user_profiles").update(update_data).eq("user_id", user_id_str).execute()
    
    if not result.data:
         raise HTTPException(status_code=500, detail="Database update failed")

    # After update, always re-enrich the data so the UI gets the correct plan status immediately
    return await get_enriched_profile_logic(user_id, result.data[0], db)
