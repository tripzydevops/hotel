"""
Security utilities for Hotel Rate Monitor.
Enforces resource ownership and prevents ID harvesting.
"""
from uuid import UUID
from fastapi import HTTPException
from typing import Any

def verify_ownership(resource_user_id: Any, current_user: Any, admin_bypass: bool = True):
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
            role = getattr(current_user, 'role', None) or current_user.user_metadata.get('role', 'user')
            if role in ["admin", "market_admin", "market admin"]:
                return True
                
        raise HTTPException(status_code=403, detail="Forbidden: Resource ownership mismatch")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=403, detail="Forbidden: Ownership verification failed")
