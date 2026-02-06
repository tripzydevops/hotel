
from datetime import datetime, timezone
from typing import Dict, Any, Tuple

# Mock Config (In production, load from DB table 'tier_config')
TIERS = {
    "trial": {"max_hotels": 3, "can_scan_hourly": False, "history_days": 7},
    "starter": {"max_hotels": 10, "can_scan_hourly": False, "history_days": 30},
    "pro": {"max_hotels": 50, "can_scan_hourly": True, "history_days": 365},
    "enterprise": {"max_hotels": 9999, "can_scan_hourly": True, "history_days": 9999}
}

class SubscriptionService:
    """
    Handles RBAC/UBAC logic for Membership System.
    Decoupled from Billing (Stripe) logic.
    """

    @staticmethod
    def get_user_limits(profile: Dict[str, Any]) -> Dict[str, Any]:
        """Return the limits for a specific user profile."""
        tier = profile.get("plan_type", "trial")
        status = profile.get("subscription_status", "trial")
        
        # Default to trial if not set
        if not tier: tier = "trial"
        
        # Check Expiration
        if status == "trial":
            trial_end = profile.get("current_period_end")
            if trial_end:
                # Parse if string
                if isinstance(trial_end, str):
                    try:
                        trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                    except:
                        pass
                
                # Check if expired
                if isinstance(trial_end, datetime) and datetime.now(timezone.utc) > trial_end:
                    return {"state": "locked", "reason": "Trial Expired"}
        
        elif status not in ["active", "trial"]:
            return {"state": "locked", "reason": "No Active Subscription"}

        # Return Limits
        config = TIERS.get(tier, TIERS["trial"])
        return {"state": "active", "limits": config, "tier": tier}

    @staticmethod
    def check_hotel_limit(db, user_id: str, profile: Dict[str, Any]) -> Tuple[bool, str]:
        """Check if user can add more hotels."""
        access = SubscriptionService.get_user_limits(profile)
        
        if access["state"] == "locked":
            return False, f"Access Locked: {access.get('reason')}"
            
        limit = access["limits"]["max_hotels"]
        
        # Count current usage
        count_res = db.table("hotels").select("id", count="exact").eq("user_id", user_id).execute()
        current_count = count_res.count
        
        if current_count >= limit:
            return False, f"Plan Limit Reached ({current_count}/{limit}). Please Upgrade."
            
        return True, "OK"
