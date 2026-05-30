"""
Proactive Alert Service — B2B Competitive Intelligence Alerts
Evaluates a hotel's market position and generates proactive alerts for:
  - Margin erosion (competitor undercuts target by > threshold)
  - Competitor rate surge (competitor raises price significantly — opportunity)
  - Parity violation (target hotel price differs across OTAs)
  - Sentiment drop alert (review score falls below threshold)
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from supabase import Client

logger = logging.getLogger(__name__)

# Thresholds (can be made user-configurable in future)
UNDERCUT_THRESHOLD_PCT = 5.0     # competitor is 5%+ cheaper = margin erosion
SURGE_THRESHOLD_PCT = 15.0       # competitor raises 15%+ = revenue opportunity
PARITY_THRESHOLD_PCT = 3.0       # >3% OTA price difference = parity violation
SENTIMENT_DROP_THRESHOLD = 0.3   # 0.3 point drop in 30 days = sentiment alert


async def evaluate_proactive_alerts(
    db: Client, user_id: str, hotel_id: str
) -> List[Dict[str, Any]]:
    """
    Runs all proactive alert evaluations for a given hotel and user.
    Persists new alerts to the `alerts` table and returns the new alerts list.

    This is called:
    - POST /api/alerts/evaluate/{hotel_id} (on-demand)
    - Automatically at the end of each scan session (via monitor_service.py)
    """
    new_alerts: List[Dict[str, Any]] = []

    try:
        # 1. Fetch target hotel's latest price
        target_res = (
            db.table("price_logs")
            .select("price, currency, recorded_at")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(1)
            .execute()
        )
        if not target_res.data:
            return []

        target_price = target_res.data[0]["price"]
        currency = target_res.data[0]["currency"] or "TRY"

        if not target_price or target_price <= 0:
            return []

        # 2. Fetch hotel name
        hotel_res = db.table("hotels").select("name").eq("id", hotel_id).single().execute()
        hotel_name = hotel_res.data.get("name", "Your Hotel") if hotel_res.data else "Your Hotel"

        # 3. Fetch competitor hotels for this user
        comp_res = (
            db.table("user_hotels")
            .select("hotel_id, hotels(id, name)")
            .eq("user_id", user_id)
            .neq("hotel_id", hotel_id)
            .execute()
        )
        competitor_ids = [
            row["hotel_id"] for row in (comp_res.data or [])
            if row.get("hotel_id") and row["hotel_id"] != hotel_id
        ]
        competitor_names = {
            row["hotel_id"]: (row.get("hotels") or {}).get("name", "Competitor")
            for row in (comp_res.data or [])
        }

        if not competitor_ids:
            return []

        # 4. Fetch competitors' latest prices
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        comp_prices_res = (
            db.table("price_logs")
            .select("hotel_id, price, currency, recorded_at")
            .in_("hotel_id", competitor_ids)
            .gte("recorded_at", cutoff)
            .order("recorded_at", desc=True)
            .execute()
        )

        # Deduplicate — keep only the latest price per competitor
        seen: set = set()
        competitor_latest: List[Dict] = []
        for row in (comp_prices_res.data or []):
            if row["hotel_id"] not in seen and row["price"] and row["price"] > 0:
                seen.add(row["hotel_id"])
                competitor_latest.append(row)

        # 5. Evaluate each competitor
        for comp in competitor_latest:
            comp_price = comp["price"]
            comp_name = competitor_names.get(comp["hotel_id"], "Competitor")
            pct_diff = ((target_price - comp_price) / comp_price) * 100

            # Margin Erosion: competitor is significantly cheaper
            if pct_diff > UNDERCUT_THRESHOLD_PCT:
                alert = _build_alert(
                    user_id=user_id,
                    hotel_id=hotel_id,
                    alert_type="margin_erosion",
                    severity="high",
                    title="⚠️ Margin Erosion Detected",
                    message=(
                        f"{comp_name} is {pct_diff:.1f}% cheaper than {hotel_name} "
                        f"({_fmt(comp_price, currency)} vs {_fmt(target_price, currency)}). "
                        f"Consider a rate adjustment to protect occupancy."
                    ),
                    metadata={
                        "competitor_id": comp["hotel_id"],
                        "competitor_name": comp_name,
                        "target_price": target_price,
                        "competitor_price": comp_price,
                        "diff_pct": round(pct_diff, 2),
                        "currency": currency,
                    },
                )
                new_alerts.append(alert)

            # Surge Opportunity: competitor is significantly more expensive
            elif pct_diff < -SURGE_THRESHOLD_PCT:
                alert = _build_alert(
                    user_id=user_id,
                    hotel_id=hotel_id,
                    alert_type="rate_opportunity",
                    severity="medium",
                    title="📈 Rate Opportunity",
                    message=(
                        f"{comp_name} raised rates by {abs(pct_diff):.1f}% above {hotel_name}. "
                        f"Market may support a price increase of up to {abs(pct_diff) * 0.5:.0f}%."
                    ),
                    metadata={
                        "competitor_id": comp["hotel_id"],
                        "competitor_name": comp_name,
                        "target_price": target_price,
                        "competitor_price": comp_price,
                        "diff_pct": round(pct_diff, 2),
                        "currency": currency,
                    },
                )
                new_alerts.append(alert)

        # 6. Parity Check — compare target hotel's prices across OTAs
        parity_alerts = await _check_parity(db, user_id, hotel_id, hotel_name, currency)
        new_alerts.extend(parity_alerts)

        # 7. Persist new alerts (deduplicate by type + hotel within last 6h)
        persisted = await _persist_alerts(db, new_alerts)
        return persisted

    except Exception as e:
        logger.error(f"Proactive alert evaluation failed for hotel {hotel_id}: {e}")
        return []


async def _check_parity(
    db: Client, user_id: str, hotel_id: str, hotel_name: str, currency: str
) -> List[Dict]:
    """Checks if the hotel's prices differ significantly across OTA sources."""
    alerts = []
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
        res = (
            db.table("price_logs")
            .select("price, source, recorded_at")
            .eq("hotel_id", hotel_id)
            .gte("recorded_at", cutoff)
            .order("recorded_at", desc=True)
            .limit(20)
            .execute()
        )

        prices_by_source: Dict[str, float] = {}
        for row in (res.data or []):
            src = row.get("source") or "unknown"
            price = row.get("price") or 0
            if price > 0 and src not in prices_by_source:
                prices_by_source[src] = price

        if len(prices_by_source) < 2:
            return []

        values = list(prices_by_source.values())
        min_p, max_p = min(values), max(values)
        if min_p <= 0:
            return []

        parity_diff_pct = ((max_p - min_p) / min_p) * 100
        if parity_diff_pct > PARITY_THRESHOLD_PCT:
            worst_high = max(prices_by_source, key=lambda k: prices_by_source[k])
            worst_low = min(prices_by_source, key=lambda k: prices_by_source[k])
            alerts.append(
                _build_alert(
                    user_id=user_id,
                    hotel_id=hotel_id,
                    alert_type="parity_violation",
                    severity="high",
                    title="🔴 OTA Parity Violation",
                    message=(
                        f"{hotel_name} has a {parity_diff_pct:.1f}% price gap across OTAs. "
                        f"{worst_high} shows {_fmt(max_p, currency)}, "
                        f"{worst_low} shows {_fmt(min_p, currency)}. "
                        f"Fix parity to avoid OTA ranking penalties."
                    ),
                    metadata={
                        "prices_by_source": prices_by_source,
                        "parity_diff_pct": round(parity_diff_pct, 2),
                        "currency": currency,
                    },
                )
            )
    except Exception as e:
        logger.warning(f"Parity check failed: {e}")
    return alerts


async def _persist_alerts(db: Client, alerts: List[Dict]) -> List[Dict]:
    """
    Inserts alerts but skips duplicates (same alert_type + hotel within 6 hours).
    Returns only the newly persisted alerts.
    """
    if not alerts:
        return []

    persisted = []
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()

    for alert in alerts:
        try:
            # Check for recent duplicate
            existing = (
                db.table("alerts")
                .select("id")
                .eq("hotel_id", alert["hotel_id"])
                .eq("alert_type", alert.get("alert_type", "general"))
                .gte("created_at", cutoff)
                .execute()
            )
            if existing.data:
                continue  # Skip duplicate

            res = db.table("alerts").insert(alert).execute()
            if res.data:
                persisted.append(res.data[0])
        except Exception as e:
            logger.warning(f"Failed to persist alert: {e}")

    return persisted


def _build_alert(
    user_id: str,
    hotel_id: str,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "hotel_id": hotel_id,
        "alert_type": alert_type,
        "severity": severity,
        "title": title,
        "message": message,
        "metadata": metadata or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _fmt(price: float, currency: str) -> str:
    return f"{currency} {price:,.0f}"
