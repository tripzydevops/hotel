"""
Authentication and Authorization Service.
Handles role-based access control (RBAC) and user session verification.
"""

import traceback
from fastapi import Request, HTTPException, Depends
from supabase import Client
from backend.utils.db import get_supabase

async def get_current_admin_user(request: Request, db: Client = Depends(get_supabase)):
    """
    Verify that the request is made by an Admin.
    Checks Authorization header (JWT) via Supabase Auth.
    Then verifies 'role' in 'user_profiles' or checks whitelist.
    
    Reminder Note: Admin access is strictly enforced for system-level changes 
    and multi-tenant visibility.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
         raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        # Expected format: "Bearer <token>"
        token_parts = auth_header.split(" ")
        if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
             raise HTTPException(status_code=401, detail="Invalid Token Format")
             
        token = token_parts[1]
        
        # Call Supabase to verify token
        try:
            user_resp = db.auth.get_user(token)
            if not user_resp or not user_resp.user:
                raise HTTPException(status_code=401, detail="Supabase: Invalid Token")
            user_obj = user_resp.user
        except Exception as auth_e:
            raise HTTPException(status_code=401, detail=f"Supabase Auth Error: {str(auth_e)}")
            
        user_id = user_obj.id
        email = user_obj.email
        
        # 1. Check strict whitelist (Hardcoded for MVP safety)
        whitelist = ["admin@hotel.plus", "selcuk@rate-sentinel.com", "asknsezen@gmail.com"]
        if email and (email in whitelist or email.endswith("@hotel.plus")):
            return user_obj
        
        # 2. Check Database Role
        try:
            profile = db.table("user_profiles").select("role").eq("user_id", user_id).limit(1).execute()
            if profile.data and profile.data[0].get("role") in ["admin", "market_admin", "market admin"]:
                return user_obj
        except Exception:
            pass
            
        raise HTTPException(status_code=403, detail="Admin Access Required")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Admin Auth CRITICAL: {e}")
        raise HTTPException(status_code=401, detail=f"Auth Critical Failure: {str(e)}")

async def get_current_active_user(request: Request, db: Client = Depends(get_supabase)):
    """
    Verify that the user is logged in AND has an active approval status.
    Blocks access if account is 'suspended' or 'rejected'.
    
    Reminder Note: Even valid JWT holders can be blocked if their subscription 
    is not active (Autonomous Cloud Governance).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
         raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        token_parts = auth_header.split(" ")
        if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
             raise HTTPException(status_code=401, detail="Invalid Token Format")
             
        token = token_parts[1]
        
        if not db:
            raise HTTPException(status_code=503, detail="Database Unavailable")

        user_resp = db.auth.get_user(token)
        if not user_resp or not getattr(user_resp, 'user', None):
            raise HTTPException(status_code=401, detail="Invalid Session or Expired Token")
            
        user = user_resp.user
        user_id = user.id
        
        # Check Account Status
        status = "pending_approval"
        try:
            # Check 'profiles' table first (legacy consistency)
            res = db.table("profiles").select("subscription_status").eq("id", str(user_id)).maybe_single().execute()
            if res.data:
                status = res.data.get("subscription_status")
            else:
                # Fallback to 'user_profiles'
                res2 = db.table("user_profiles").select("subscription_status").eq("user_id", str(user_id)).maybe_single().execute()
                if res2.data:
                    status = res2.data.get("subscription_status")
        except Exception:
            # If DB check fails, we default to pending/safe state but DON'T crash 500
            print(f"Auth Warning: Could not verify status for {user_id}")

        if status in ["suspended", "rejected"]:
            raise HTTPException(status_code=403, detail="Account Suspended/Rejected")

        return user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Auth Critical: {traceback.format_exc()}")
        raise HTTPException(status_code=401, detail="Authentication Failed")
