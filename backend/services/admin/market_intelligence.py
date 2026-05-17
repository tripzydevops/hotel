"""
Admin — Market Intelligence Aggregator
========================================
Provides aggregated analytics across hotels, scans, and pricing
for the admin dashboard overview panels.

Extracted from admin_service.py (§1.2 decomposition).
Exception handling hardened per §1.1 audit.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from postgrest.exceptions import APIError as PostgRESTError
from supabase import Client

from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def get_market_overview_logic(
    db: Client,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Return a high-level market overview across all monitored hotels.
    Includes total scans, average parity score, OTA coverage, and
    price-change velocity for the given time window.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    overview: Dict[str, Any] = {
        "period_days": days,
        "total_hotels": 0,
        "total_scans": 0,
        "avg_parity_score": None,
        "price_changes": 0,
        "ota_coverage": {},
    }

    # --- Hotel count ---
    try:
        res = db.table("hotels").select("id", count="exact").execute()
        overview["total_hotels"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Hotel count query failed: {e}")

    # --- Scan count in window ---
    try:
        res = (
            db.table("extraction_sessions")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        overview["total_scans"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Scan count query failed: {e}")

    # --- Average parity score ---
    try:
        res = (
            db.table("parity_scores")
            .select("score")
            .gte("created_at", cutoff)
            .execute()
        )
        scores = [r["score"] for r in (res.data or []) if r.get("score") is not None]
        if scores:
            overview["avg_parity_score"] = round(sum(scores) / len(scores), 2)
    except PostgRESTError as e:
        logger.warning(f"Parity score aggregation failed: {e}")
    except (KeyError, TypeError, ValueError) as e:
        logger.warning(f"Parity score data error: {e}")

    # --- Price-change count ---
    try:
        res = (
            db.table("price_logs")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        overview["price_changes"] = res.count or 0
    except PostgRESTError as e:
        logger.warning(f"Price-change count query failed: {e}")

    # --- OTA coverage breakdown ---
    try:
        res = (
            db.table("price_logs")
            .select("source")
            .gte("created_at", cutoff)
            .execute()
        )
        coverage: Dict[str, int] = {}
        for row in res.data or []:
            src = row.get("source", "unknown")
            coverage[src] = coverage.get(src, 0) + 1
        overview["ota_coverage"] = coverage
    except PostgRESTError as e:
        logger.warning(f"OTA coverage query failed: {e}")

    return overview


async def get_price_trends_logic(
    db: Client,
    hotel_id: Optional[str] = None,
    days: int = 14,
    granularity: str = "day",  # "day" | "hour"
) -> List[Dict[str, Any]]:
    """
    Return price trend data points for charting.
    Optionally scoped to a single hotel.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        query = (
            db.table("price_logs")
            .select("created_at, price, source, room_type")
            .gte("created_at", cutoff)
            .order("created_at")
        )
        if hotel_id:
            query = query.eq("hotel_id", hotel_id)

        res = query.execute()
        rows = res.data or []

        # Group by granularity
        buckets: Dict[str, List[float]] = {}
        for row in rows:
            ts = row.get("created_at", "")
            key = ts[:10] if granularity == "day" else ts[:13]  # YYYY-MM-DD or YYYY-MM-DDTHH
            price = row.get("price")
            if price is not None:
                buckets.setdefault(key, []).append(float(price))

        return [
            {
                "date": k,
                "avg_price": round(sum(v) / len(v), 2),
                "min_price": round(min(v), 2),
                "max_price": round(max(v), 2),
                "sample_count": len(v),
            }
            for k, v in sorted(buckets.items())
        ]
    except PostgRESTError as e:
        logger.warning(f"Price trends DB query failed: {e}")
        return []
    except (ValueError, TypeError) as e:
        logger.warning(f"Price trends data conversion error: {e}")
        return []


async def get_competitor_matrix_logic(
    db: Client,
    hotel_id: str,
) -> Dict[str, Any]:
    """
    Build a competitor pricing matrix for a specific hotel.
    Shows latest prices across OTAs side-by-side.
    """
    try:
        # Get latest prices per source/room_type
        res = (
            db.table("price_logs")
            .select("source, room_type, price, created_at")
            .eq("hotel_id", hotel_id)
            .order("created_at", desc=True)
            .limit(200)
        )
        result = res.execute()
        rows = result.data or []

        # Deduplicate: keep latest per (source, room_type)
        seen: set = set()
        matrix: List[Dict[str, Any]] = []
        for row in rows:
            key = (row.get("source"), row.get("room_type"))
            if key not in seen:
                seen.add(key)
                matrix.append(row)

        return {
            "hotel_id": hotel_id,
            "entries": matrix,
            "sources": list({r.get("source") for r in matrix}),
            "room_types": list({r.get("room_type") for r in matrix}),
        }
    except PostgRESTError as e:
        logger.warning(f"Competitor matrix DB query failed for {hotel_id}: {e}")
        return {"hotel_id": hotel_id, "entries": [], "sources": [], "room_types": []}
    except (KeyError, TypeError) as e:
        logger.warning(f"Competitor matrix data error for {hotel_id}: {e}")
        return {"hotel_id": hotel_id, "entries": [], "sources": [], "room_types": []}


async def get_alert_summary_logic(
    db: Client,
    days: int = 7,
) -> Dict[str, Any]:
    """
    Summarize parity alerts generated in the given window.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        res = (
            db.table("parity_alerts")
            .select("*")
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .execute()
        )
        alerts = res.data or []

        by_severity: Dict[str, int] = {}
        for a in alerts:
            sev = a.get("severity", "info")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "period_days": days,
            "total_alerts": len(alerts),
            "by_severity": by_severity,
            "recent": alerts[:20],
        }
    except PostgRESTError as e:
        logger.warning(f"Alert summary DB query failed: {e}")
        return {
            "period_days": days,
            "total_alerts": 0,
            "by_severity": {},
            "recent": [],
        }


async def get_admin_market_intelligence_logic(
    db: Client, city: Optional[str] = None
) -> Dict[str, Any]:
    """
    Aggregate market intelligence for admin panel Intelligence tab.

    Fetches hotels from the global directory (filtered by city), then looks up
    the latest price for each hotel from price_logs. Returns the { hotels, summary }
    shape expected by the AnalyticsPanel frontend component.

    Migrated from admin_service.py monolith (§1.2 decomposition).
    """
    import random
    import traceback

    try:
        # 1. Fetch hotels from directory, filtered by city if specified
        query = (
            db.table("hotel_directory")
            .select("*")
            .order("created_at", desc=True)
            .limit(200)
        )
        if city:
            query = query.ilike("location", f"%{city}%")
        dir_result = query.execute()
        directory_hotels = dir_result.data or []

        # 2. Fetch latest prices from tracked hotels in the same city
        hotels_query = db.table("hotels").select("id, name, location, serp_api_id")
        if city:
            hotels_query = hotels_query.ilike("location", f"%{city}%")
        tracked_result = hotels_query.limit(200).execute()
        tracked_hotels = tracked_result.data or []

        # Build map of latest prices and coordinates from tracked hotels
        tracked_meta: Dict[str, Dict[str, Any]] = {}
        for h in tracked_hotels:
            hid = str(h["id"])
            tracked_meta[hid] = {
                "price": h.get("current_price", 0) or 0,
                "lat": h.get("latitude"),
                "lng": h.get("longitude"),
                "serp_id": h.get("serp_api_id"),
                "name": h.get("name", "").lower(),
            }

        # Deep Price Recovery: latest price from logs, fallback to current_price column
        price_map = {hid: meta["price"] for hid, meta in tracked_meta.items()}

        if tracked_hotels:
            recent_logs = (
                db.table("price_logs")
                .select("hotel_id, price")
                .in_("hotel_id", [str(h["id"]) for h in tracked_hotels])
                .order("recorded_at", desc=True)
                .limit(len(tracked_hotels) * 10)
                .execute()
            )

            for log in recent_logs.data or []:
                hid = str(log["hotel_id"])
                if hid not in price_map or price_map[hid] == 0:
                    price_map[hid] = log.get("price", 0)

        # 3. Build unified hotel list from directory entries
        hotels_out: List[Dict[str, Any]] = []

        for dh in directory_hotels:
            latest_price = 0
            matched_meta = None

            # Match Logic: SerpID First, then Exact Name, then Fuzzy Name
            serp_id = dh.get("serp_api_id")
            dh_name = dh.get("name", "").lower()

            for hid, m in tracked_meta.items():
                if serp_id and m["serp_id"] == serp_id:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break
                if dh_name == m["name"]:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break
                if dh_name in m["name"] or m["name"] in dh_name:
                    matched_meta = m
                    latest_price = price_map.get(hid, 0)
                    break

            # Coordinate Fallback Chain:
            # 1. Directory coords → 2. Tracked coords → 3. City center jitter
            lat = dh.get("latitude")
            lng = dh.get("longitude")

            if (lat is None or lng is None) and matched_meta:
                lat = matched_meta.get("lat") if lat is None else lat
                lng = matched_meta.get("lng") if lng is None else lng

            # District-Aware Fallback for Balikesir region
            if (lat is None or lng is None) and city and city.lower() == "balikesir":
                loc_str = (dh.get("location") or "").lower()

                if "ayvalik" in loc_str or "cunda" in loc_str or "küçükköy" in loc_str:
                    lat_base, lng_base = 39.3197, 26.6908
                elif (
                    "edremit" in loc_str
                    or "akcay" in loc_str
                    or "altinoluk" in loc_str
                    or "akçay" in loc_str
                ):
                    lat_base, lng_base = 39.5852, 26.9248
                else:
                    lat_base, lng_base = 39.6482, 27.8826

                lat = lat_base + (random.random() - 0.5) * 0.03
                lng = lng_base + (random.random() - 0.5) * 0.03

            hotels_out.append(
                {
                    "id": str(dh["id"]),
                    "name": dh["name"],
                    "location": dh.get("location", "Unknown"),
                    "latest_price": float(latest_price),
                    "latitude": lat,
                    "longitude": lng,
                    "rating": dh.get("rating"),
                    "serp_api_id": dh.get("serp_api_id"),
                }
            )

        # Summary Statistics
        prices = [
            h["latest_price"]
            for h in hotels_out
            if h["latest_price"] and h["latest_price"] > 0
        ]
        avg_price = round(sum(prices) / len(prices), 2) if prices else 0
        price_range = [min(prices), max(prices)] if prices else [0, 0]
        with_price_count = len(prices)
        total_count = len(hotels_out)
        scan_coverage = (
            round((with_price_count / total_count) * 100, 1) if total_count > 0 else 0
        )

        # Historical Visibility Data (Last 30 days)
        visibility_data: List[Dict[str, Any]] = []
        try:
            hotel_ids_for_vis = [str(h["id"]) for h in tracked_hotels]

            if hotel_ids_for_vis:
                thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()

                vis_query = (
                    db.table("price_logs")
                    .select("recorded_at, search_rank, price")
                    .in_("hotel_id", hotel_ids_for_vis)
                    .gte("recorded_at", thirty_days_ago)
                    .order("recorded_at", desc=False)
                    .execute()
                )

                raw_vis = vis_query.data or []

                # Synthetic Rank Fallback (price-based if no search_rank)
                has_any_rank = any(e.get("search_rank") is not None for e in raw_vis)

                if not has_any_rank and raw_vis:
                    by_date: Dict[str, list] = {}
                    for e in raw_vis:
                        d = e["recorded_at"].split("T")[0]
                        if d not in by_date:
                            by_date[d] = []
                        by_date[d].append(e)

                    for d, entries in by_date.items():
                        sorted_entries = sorted(
                            entries, key=lambda x: x.get("price", 999999)
                        )
                        for i, e in enumerate(sorted_entries):
                            e["search_rank"] = i + 1

                daily_aggregates: Dict[str, Dict[str, float]] = {}
                for entry in raw_vis:
                    val_rank = entry.get("search_rank")
                    if val_rank is None or not entry.get("recorded_at"):
                        continue

                    dt_str = entry["recorded_at"].split("T")[0]
                    if dt_str not in daily_aggregates:
                        daily_aggregates[dt_str] = {
                            "sum_rank": 0.0,
                            "count": 0,
                            "sum_price": 0.0,
                        }

                    daily_aggregates[dt_str]["sum_rank"] += float(val_rank)
                    daily_aggregates[dt_str]["sum_price"] += entry.get("price", 0)
                    daily_aggregates[dt_str]["count"] += 1

                for date_key in sorted(daily_aggregates.keys()):
                    agg = daily_aggregates[date_key]
                    visibility_data.append(
                        {
                            "date": date_key,
                            "rank": round(agg["sum_rank"] / agg["count"], 1),
                            "price": round(agg["sum_price"] / agg["count"], 2),
                        }
                    )
        except Exception as e:
            logger.warning(f"Visibility Aggregation Error: {e}")

        # Dynamic Currency Detection
        detected_currency = "TRY"
        try:
            hotel_ids_for_curr = [str(h["id"]) for h in tracked_hotels]
            if hotel_ids_for_curr:
                curr_res = (
                    db.table("price_logs")
                    .select("currency")
                    .in_("hotel_id", hotel_ids_for_curr)
                    .not_.is_("currency", "null")
                    .limit(1)
                    .execute()
                )
                if curr_res.data:
                    detected_currency = curr_res.data[0].get("currency", "TRY")
        except Exception:
            pass

        # Competitive Network Generation
        priced_subset = sorted(
            [h for h in hotels_out if h["latest_price"] > 0],
            key=lambda x: x["latest_price"],
            reverse=True,
        )[:15]
        nodes: List[Dict[str, Any]] = []
        links: List[Dict[str, Any]] = []

        target_id = None
        for h in tracked_hotels:
            if h.get("is_target_hotel"):
                target_id = str(h["id"])
                break

        has_target = False
        for h in priced_subset:
            hid = str(h["id"])
            is_main = (hid == target_id) or (not target_id and not has_target)
            if is_main:
                has_target = True

            nodes.append(
                {
                    "id": hid,
                    "label": h["name"],
                    "value": float(h["latest_price"]),
                    "type": "target" if is_main else "competitor",
                }
            )

        for i in range(len(priced_subset)):
            if i + 1 < len(priced_subset):
                links.append(
                    {
                        "source": priced_subset[i]["id"],
                        "target": priced_subset[i + 1]["id"],
                        "label": "Price Rival",
                    }
                )
            if i + 2 < len(priced_subset):
                links.append(
                    {
                        "source": priced_subset[i]["id"],
                        "target": priced_subset[i + 2]["id"],
                        "label": "Market Tier",
                    }
                )

        # Latest Agentic Briefing
        latest_briefing = None
        try:
            lb_res = (
                db.table("reports")
                .select("report_data, created_at")
                .eq("report_type", "briefing")
                .is_("created_by", "null")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if lb_res.data:
                latest_briefing = lb_res.data[0]
        except Exception as lb_e:
            logger.warning(f"Failed to fetch latest briefing: {lb_e}")

        return {
            "hotels": hotels_out,
            "visibility": visibility_data,
            "network": {"nodes": nodes, "links": links},
            "latest_briefing": latest_briefing,
            "summary": {
                "hotel_count": total_count,
                "avg_price": avg_price,
                "price_range": price_range,
                "scan_coverage_pct": scan_coverage,
                "currency": detected_currency,
                "currency_symbol": "₺" if detected_currency == "TRY" else "$",
            },
        }
    except Exception as e:
        logger.error(f"Admin Market Intelligence Error: {e}")
        traceback.print_exc()
        return {
            "hotels": [],
            "summary": {
                "hotel_count": 0,
                "avg_price": 0,
                "price_range": [0, 0],
                "scan_coverage_pct": 0,
            },
        }
