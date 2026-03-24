from datetime import datetime, timezone
from typing import Dict, Any, Tuple

import time

# Fallback Configuration (Used if DB table is missing or unreachable)
DEFAULT_TIERS = {
    "trial": {
        "hotel_limit": 9999,
        "ui_comparison_limit": 15,
        "can_scan_hourly": True,
        "history_days": 9999,
    },
    "starter": {
        "hotel_limit": 20,
        "ui_comparison_limit": 5,
        "can_scan_hourly": False,
        "history_days": 30,
    },
    "pro": {
        "hotel_limit": 100,
        "ui_comparison_limit": 10,
        "can_scan_hourly": True,
        "history_days": 365,
    },
    "enterprise": {
        "hotel_limit": 9999,
        "ui_comparison_limit": 15,
        "can_scan_hourly": True,
        "history_days": 9999,
    },
}

# Global cache to minimize DB pressure
# Structure: { name: config }
_tier_cache: Dict[str, Any] = {}
_cache_expiry: float = 0
CACHE_TTL = 300  # 5 minutes


class SubscriptionService:
    """
    Handles RBAC/UBAC logic for Membership System.
    Decoupled from Billing logic. Fetching limits from DB for dynamic admin control.
    """

    @staticmethod
    async def get_all_tiers(db) -> Dict[str, Any]:
        """Fetch all tiers from DB with local caching."""
        global _tier_cache, _cache_expiry

        now = time.time()
        if _tier_cache and now < _cache_expiry:
            return _tier_cache

        try:
            # Attempt to fetch from dynamic membership_plans table
            # Admin can update this any time via Supabase dashboard or Admin UI
            res = db.table("membership_plans").select("*").execute()
            if res.data:
                new_cache = {t["name"].lower(): t for t in res.data}
                _tier_cache = new_cache
                _cache_expiry = now + CACHE_TTL
                return _tier_cache
        except Exception as e:
            print(f"[Subscription] DB Fetch Warning: {e}. Using fallback TIERS.")

        return DEFAULT_TIERS

    @staticmethod
    async def get_user_limits(db, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Return the limits for a specific user profile."""
        tier = (profile.get("plan_type") or "trial").lower()
        status = profile.get("subscription_status", "trial")

        # Check Expiration for Trial
        if status == "trial":
            trial_end = profile.get("current_period_end")
            if trial_end:
                if isinstance(trial_end, str):
                    try:
                        trial_end = datetime.fromisoformat(
                            trial_end.replace("Z", "+00:00")
                        )
                    except Exception:
                        pass

                if (
                    isinstance(trial_end, datetime)
                    and datetime.now(timezone.utc) > trial_end
                ):
                    return {"state": "locked", "reason": "Trial Expired"}

        elif status not in ["active", "trial"]:
            return {"state": "locked", "reason": "No Active Subscription"}

        # Fetch latest dynamic config
        tiers = await SubscriptionService.get_all_tiers(db)
        config = tiers.get(tier, tiers.get("trial", DEFAULT_TIERS["trial"]))

        return {"state": "active", "limits": config, "tier": tier}

    @staticmethod
    async def check_hotel_limit(
        db, user_id: str, profile: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """Check if user can add more hotels based on dynamic plan limits."""
        access = await SubscriptionService.get_user_limits(db, profile)

        if access["state"] == "locked":
            return False, f"Access Locked: {access.get('reason')}"

        limit = access["limits"].get("hotel_limit", 5)

        # Count current usage (not soft-deleted)
        count_res = (
            db.table("hotels")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        current_count = count_res.count or 0

        if current_count >= limit:
            return (
                False,
                f"Plan Limit Reached ({current_count}/{limit}). Please Upgrade.",
            )

        return True, "OK"
