"""
Copilot Service — Data Access Layer
====================================
Provides async database access functions used as tools by the CopilotAgent.
Each function queries InsForge (Supabase-compatible) tables and returns
structured data for the AI reasoning engine.

Tables accessed:
  - price_logs: Historical rate data per hotel
  - alerts: Parity violation alerts
  - user_hotels + hotels: User-hotel ownership mappings
  - (in-memory): Rate simulation via historical averages
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from backend.utils.logger import get_logger

logger = get_logger(__name__)


async def fetch_historical_rates(
    db: Client,
    hotel_id: str,
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Retrieves recent price logs for a hotel.

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.
        days: Lookback window in days (default 30).

    Returns:
        List of price log records sorted by recorded_at descending.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        res = (
            db.table("price_logs")
            .select("id, hotel_id, price, currency, source, recorded_at")
            .eq("hotel_id", hotel_id)
            .gte("recorded_at", cutoff)
            .order("recorded_at", desc=True)
            .limit(500)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_historical_rates failed: {e}")
        return []


async def fetch_parity_alerts(
    db: Client,
    hotel_id: str,
) -> List[Dict[str, Any]]:
    """
    Retrieves unresolved parity violation alerts for a hotel.

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.

    Returns:
        List of active/unresolved alert records.
    """
    try:
        res = (
            db.table("alerts")
            .select("id, hotel_id, alert_type, message, severity, source, created_at, metadata")
            .eq("hotel_id", hotel_id)
            .eq("resolved", False)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_parity_alerts failed: {e}")
        return []


async def fetch_hotel_context(
    db: Client,
    user_id: str,
) -> List[Dict[str, Any]]:
    """
    Retrieves all hotels associated with a user, including hotel metadata.

    Joins user_hotels with the hotels table to provide name, rating,
    preferred currency, and relationship type (target/competitor).

    Args:
        db: InsForge/Supabase client instance.
        user_id: UUID of the authenticated user.

    Returns:
        List of hotel context records with ownership metadata.
    """
    try:
        res = (
            db.table("user_hotels")
            .select("hotel_id, is_target, hotels(id, name, rating, review_count, preferred_currency, location)")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []

        # Flatten the joined hotel data for easier consumption
        hotels = []
        for row in rows:
            hotel_data = row.get("hotels") or {}
            if isinstance(hotel_data, list):
                hotel_data = hotel_data[0] if hotel_data else {}
            hotels.append({
                "hotel_id": row.get("hotel_id"),
                "relationship_type": "target" if row.get("is_target", False) else "competitor",
                "name": hotel_data.get("name"),
                "rating": hotel_data.get("rating"),
                "review_count": hotel_data.get("review_count"),
                "preferred_currency": hotel_data.get("preferred_currency", "TRY"),
                "location": hotel_data.get("location"),
            })
        return hotels
    except Exception as e:
        logger.error(f"[CopilotService] fetch_hotel_context failed: {e}")
        return []


async def simulate_rate(
    db: Client,
    hotel_id: str,
    target_occupancy: float,
) -> Dict[str, Any]:
    """
    Calculates a recommended rate using historical averages and demand multipliers.

    This is a pure in-memory calculation — no database writes.
    Uses a simple demand curve: higher target occupancy → lower recommended rate,
    and vice versa. The baseline is the average historical rate.

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.
        target_occupancy: Desired occupancy percentage (0-100).

    Returns:
        Dict with recommended_rate, baseline_avg, demand_multiplier, and reasoning.
    """
    try:
        # Fetch last 30 days of price data for baseline calculation
        rates = await fetch_historical_rates(db, hotel_id, days=30)

        if not rates:
            return {
                "recommended_rate": None,
                "baseline_avg": None,
                "demand_multiplier": None,
                "reasoning": "Insufficient historical data to simulate rates. Need at least 1 data point.",
            }

        # Calculate baseline average rate
        prices = [float(r["price"]) for r in rates if r.get("price") is not None]
        if not prices:
            return {
                "recommended_rate": None,
                "baseline_avg": None,
                "demand_multiplier": None,
                "reasoning": "All historical price records have null values.",
            }

        baseline_avg = sum(prices) / len(prices)
        price_min = min(prices)
        price_max = max(prices)

        # Demand multiplier curve:
        #   - 50% occupancy target → multiplier = 1.0 (baseline)
        #   - 90% occupancy target → multiplier ≈ 0.85 (discount to fill rooms)
        #   - 30% occupancy target → multiplier ≈ 1.20 (premium, fewer rooms needed)
        # Formula: multiplier = 1.0 + (50 - target_occupancy) * 0.01
        clamped_occ = max(10.0, min(100.0, target_occupancy))
        demand_multiplier = round(1.0 + (50.0 - clamped_occ) * 0.01, 3)

        recommended_rate = round(baseline_avg * demand_multiplier, 2)

        # Determine currency from recent data
        currency = rates[0].get("currency", "TRY") if rates else "TRY"

        reasoning = (
            f"Based on {len(prices)} data points over 30 days, "
            f"the average rate is {baseline_avg:.2f} {currency} "
            f"(range: {price_min:.2f}–{price_max:.2f}). "
            f"For a target occupancy of {target_occupancy:.0f}%, "
            f"a demand multiplier of {demand_multiplier:.3f}x is applied, "
            f"yielding a recommended rate of {recommended_rate:.2f} {currency}."
        )

        return {
            "recommended_rate": recommended_rate,
            "baseline_avg": round(baseline_avg, 2),
            "demand_multiplier": demand_multiplier,
            "currency": currency,
            "data_points": len(prices),
            "reasoning": reasoning,
        }
    except Exception as e:
        logger.error(f"[CopilotService] simulate_rate failed: {e}")
        return {
            "recommended_rate": None,
            "baseline_avg": None,
            "demand_multiplier": None,
            "reasoning": f"Rate simulation error: {str(e)}",
        }


async def fetch_competitor_comparison(
    db: Client,
    user_id: str,
    hotel_id: str,
) -> Dict[str, Any]:
    """
    Fetches the latest prices for a target hotel vs its competitors.

    Retrieves all hotels in the user's portfolio and compares the target
    hotel's most recent price against each competitor's most recent price.

    Args:
        db: InsForge/Supabase client instance.
        user_id: UUID of the authenticated user.
        hotel_id: UUID of the target hotel to compare against.

    Returns:
        Dict with target hotel data, competitor list, and market summary.
    """
    try:
        # 1. Get all user hotels with their relationship types
        hotels = await fetch_hotel_context(db, user_id)
        if not hotels:
            return {"target": None, "competitors": [], "summary": "No hotels found for this user."}

        target_hotel = None
        competitor_ids = []
        for h in hotels:
            if h["hotel_id"] == hotel_id:
                target_hotel = h
            elif h.get("relationship_type") == "competitor":
                competitor_ids.append(h)

        if not target_hotel:
            return {"target": None, "competitors": [], "summary": f"Hotel {hotel_id} not found in user portfolio."}

        # 2. Get latest price for target hotel
        target_price_res = (
            db.table("price_logs")
            .select("price, currency, source, recorded_at")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(1)
            .execute()
        )
        target_price_data = target_price_res.data[0] if target_price_res.data else {}

        # 3. Get latest prices for competitors
        competitors_data = []
        for comp in competitor_ids:
            try:
                comp_price_res = (
                    db.table("price_logs")
                    .select("price, currency, source, recorded_at")
                    .eq("hotel_id", comp["hotel_id"])
                    .order("recorded_at", desc=True)
                    .limit(1)
                    .execute()
                )
                comp_price = comp_price_res.data[0] if comp_price_res.data else {}
                target_p = float(target_price_data.get("price", 0))
                comp_p = float(comp_price.get("price", 0))
                diff_pct = (
                    round(((target_p - comp_p) / comp_p) * 100, 1)
                    if comp_p > 0
                    else None
                )
                competitors_data.append({
                    "hotel_id": comp["hotel_id"],
                    "name": comp.get("name"),
                    "rating": comp.get("rating"),
                    "latest_price": comp_price.get("price"),
                    "currency": comp_price.get("currency"),
                    "source": comp_price.get("source"),
                    "recorded_at": comp_price.get("recorded_at"),
                    "diff_vs_target_pct": diff_pct,
                })
            except Exception as comp_err:
                logger.warning(f"[CopilotService] Competitor price fetch failed for {comp['hotel_id']}: {comp_err}")

        # 4. Build summary
        comp_prices = [c["latest_price"] for c in competitors_data if c.get("latest_price")]
        market_avg = round(sum(comp_prices) / len(comp_prices), 2) if comp_prices else None
        target_p = float(target_price_data.get("price", 0))

        summary = f"Target hotel has {len(competitors_data)} tracked competitors."
        if market_avg and target_p > 0:
            position = "above" if target_p > market_avg else "below" if target_p < market_avg else "at"
            diff = round(abs(target_p - market_avg), 2)
            summary += f" Your rate is {position} the competitor average by {diff} {target_price_data.get('currency', 'TRY')}."

        return {
            "target": {
                **target_hotel,
                "latest_price": target_price_data.get("price"),
                "currency": target_price_data.get("currency"),
                "source": target_price_data.get("source"),
                "recorded_at": target_price_data.get("recorded_at"),
            },
            "competitors": competitors_data,
            "market_avg": market_avg,
            "summary": summary,
        }
    except Exception as e:
        logger.error(f"[CopilotService] fetch_competitor_comparison failed: {e}")
        return {"target": None, "competitors": [], "summary": f"Error: {str(e)}"}


async def fetch_sentiment_analysis(
    db: Client,
    hotel_id: str,
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Retrieves sentiment analysis data for a hotel including current ratings,
    sentiment breakdown, guest mentions, recent reviews, and sentiment velocity.

    Queries the hotels table for the current snapshot and the sentiment_history
    table for historical trend data.  Sentiment velocity is computed as the
    difference between the most recent and oldest rating in the history window.

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.
        limit: Maximum number of history entries and reviews to return (default 5).

    Returns:
        Dict with current_rating, review_count, sentiment_breakdown,
        guest_mentions, reviews, sentiment_velocity, and history list.
        Empty dict on failure.
    """
    try:
        # Current sentiment snapshot from hotels table
        hotel_res = (
            db.table("hotels")
            .select("sentiment_breakdown, reviews, guest_mentions, rating, review_count")
            .eq("id", hotel_id)
            .limit(1)
            .execute()
        )
        hotel_data = hotel_res.data[0] if hotel_res.data else {}

        # Historical sentiment entries
        history_res = (
            db.table("sentiment_history")
            .select("id, hotel_id, rating, review_count, sentiment_breakdown, recorded_at")
            .eq("hotel_id", hotel_id)
            .order("recorded_at", desc=True)
            .limit(limit)
            .execute()
        )
        history = history_res.data or []

        # Calculate sentiment velocity (rating change over the history window)
        sentiment_velocity = None
        if len(history) >= 2:
            latest_rating = float(history[0].get("rating", 0))
            oldest_rating = float(history[-1].get("rating", 0))
            sentiment_velocity = round(latest_rating - oldest_rating, 2)

        # Limit reviews returned
        raw_reviews = hotel_data.get("reviews") or []
        if isinstance(raw_reviews, list):
            raw_reviews = raw_reviews[:limit]

        return {
            "current_rating": hotel_data.get("rating"),
            "review_count": hotel_data.get("review_count"),
            "sentiment_breakdown": hotel_data.get("sentiment_breakdown"),
            "guest_mentions": hotel_data.get("guest_mentions"),
            "reviews": raw_reviews,
            "sentiment_velocity": sentiment_velocity,
            "history": history,
        }
    except Exception as e:
        logger.error(f"[CopilotService] fetch_sentiment_analysis failed: {e}")
        return {}


async def fetch_scan_sessions(
    db: Client,
    user_id: str,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Retrieves recent scan sessions for a user, including system-wide scans.

    Fetches scan session records owned by the given user or system-level scans
    (where user_id is null).  Results are ordered by creation time descending.

    Args:
        db: InsForge/Supabase client instance.
        user_id: UUID of the authenticated user.
        limit: Maximum number of sessions to return (default 10).

    Returns:
        List of scan session records or empty list on failure.
    """
    try:
        res = (
            db.table("scan_sessions")
            .select(
                "id, user_id, session_type, status, hotels_count, "
                "check_in_date, check_out_date, adults, currency, "
                "reasoning_trace, created_at, completed_at"
            )
            .or_(f"user_id.eq.{user_id},user_id.is.null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_scan_sessions failed: {e}")
        return []


async def fetch_saved_reports(
    db: Client,
    user_id: str,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Retrieves saved reports for a user, including system-generated reports.

    Fetches reports created by the given user or system-level reports
    (where created_by is null).  Results are ordered by creation time descending.

    Args:
        db: InsForge/Supabase client instance.
        user_id: UUID of the authenticated user.
        limit: Maximum number of reports to return (default 10).

    Returns:
        List of report records or empty list on failure.
    """
    try:
        res = (
            db.table("reports")
            .select("id, title, report_type, created_at, created_by, hotel_ids")
            .or_(f"created_by.eq.{user_id},created_by.is.null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_saved_reports failed: {e}")
        return []


async def fetch_market_events(
    db: Client,
    city: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves market events for a city within an optional date window.

    Searches the market_events table with case-insensitive city matching.
    When date filters are provided, returns events whose date range overlaps
    with the requested window (events that haven't ended before start_date
    and that start before end_date).

    Args:
        db: InsForge/Supabase client instance.
        city: City name to filter by (case-insensitive partial match).
        start_date: Optional ISO date string — exclude events ending before this date.
        end_date: Optional ISO date string — exclude events starting after this date.

    Returns:
        List of market event records ordered by start_date ascending,
        or empty list on failure.
    """
    try:
        query = (
            db.table("market_events")
            .select("id, name, type, city, start_date, end_date, description, compression_score, metadata")
            .ilike("city", f"%{city}%")
        )

        if start_date:
            query = query.gte("end_date", start_date)
        if end_date:
            query = query.lte("start_date", end_date)

        res = (
            query
            .order("start_date", desc=False)
            .limit(20)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_market_events failed: {e}")
        return []


async def fetch_rate_calendar(
    db: Client,
    hotel_id: str,
    start_date: str,
    end_date: str,
) -> List[Dict[str, Any]]:
    """
    Retrieves daily rate calendar data for a hotel within a date range.

    Attempts to read from the pre-aggregated price_history_daily table first.
    If no daily summary data is available, falls back to raw price_logs entries
    for the same date window.

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.
        start_date: ISO date string for the start of the window (inclusive).
        end_date: ISO date string for the end of the window (inclusive).

    Returns:
        List of rate records (daily summaries preferred, raw logs as fallback),
        or empty list on failure.
    """
    try:
        # Primary source: pre-aggregated daily summary
        daily_res = (
            db.table("price_history_daily")
            .select("date, avg_price, min_price, max_price, source, room_type_summary")
            .eq("hotel_id", hotel_id)
            .gte("date", start_date)
            .lte("date", end_date)
            .order("date", desc=False)
            .limit(90)
            .execute()
        )
        if daily_res.data:
            return daily_res.data

        # Fallback: raw price logs
        logs_res = (
            db.table("price_logs")
            .select("id, hotel_id, price, currency, source, recorded_at")
            .eq("hotel_id", hotel_id)
            .gte("recorded_at", start_date)
            .lte("recorded_at", end_date)
            .order("recorded_at", desc=False)
            .limit(500)
            .execute()
        )
        return logs_res.data or []
    except Exception as e:
        logger.error(f"[CopilotService] fetch_rate_calendar failed: {e}")
        return []


async def create_copilot_pdf_report(
    db: Client,
    user_id: str,
    target_hotel_id: str,
    rival_hotel_id: Optional[str] = None,
    report_type: str = "Strategic Market Pulse",
    days: int = 30,
) -> Dict[str, Any]:
    """
    Generates an executive briefing PDF report via the AnalystAgent and persists it.

    Orchestrates the AnalystAgent to produce a rich briefing, then stores the
    result in the reports table for later retrieval / PDF download.

    Args:
        db: InsForge/Supabase client instance.
        user_id: UUID of the requesting user.
        target_hotel_id: UUID of the primary hotel to analyse.
        rival_hotel_id: Optional UUID of a competitor hotel for comparison.
        report_type: Human-readable report type label (default "Strategic Market Pulse").
        days: Lookback window in days for the analysis (default 30).

    Returns:
        Dict with status, report_id, title, and download_url on success,
        or a dict with an error key on failure.
    """
    try:
        from backend.agents.analyst_agent import AnalystAgent

        agent = AnalystAgent(db=db)
        result = await agent.generate_executive_briefing(
            user_id=user_id,
            target_hotel_id=target_hotel_id,
            rival_hotel_id=rival_hotel_id,
            days=days,
            report_type=report_type,
        )

        if isinstance(result, dict) and "error" in result:
            return {"error": result["error"]}

        report_id = str(uuid.uuid4())

        # Build hotel_ids list
        hotel_ids = [target_hotel_id]
        if rival_hotel_id:
            hotel_ids.append(rival_hotel_id)

        title = f"{report_type} — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"

        # Persist to reports table
        db.table("reports").insert({
            "id": report_id,
            "title": title,
            "report_type": "briefing",
            "hotel_ids": hotel_ids,
            "report_data": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user_id,
        }).execute()

        return {
            "status": "success",
            "report_id": report_id,
            "title": title,
            "download_url": f"/api/reports/briefing/saved/{report_id}/pdf",
        }
    except Exception as e:
        logger.error(f"[CopilotService] create_copilot_pdf_report failed: {e}")
        return {"error": f"Failed to generate report: {str(e)}"}


async def save_hotel_reputation(
    db: Client,
    hotel_id: str,
    source: str,
    rating: float,
    review_count: Optional[int] = None,
    sentiment_breakdown: Optional[Dict[str, Any]] = None,
    reviews: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Persists a hotel reputation snapshot to the sentiment_history table and
    updates the hotels table with the latest reputation data.

    Inserts a new row in sentiment_history for trend tracking, then patches
    the hotels row with any provided fields (rating, review_count,
    sentiment_breakdown, reviews).

    Args:
        db: InsForge/Supabase client instance.
        hotel_id: UUID of the target hotel.
        source: Origin of the reputation data (e.g. "google", "booking").
        rating: Current numeric rating value.
        review_count: Optional total number of reviews.
        sentiment_breakdown: Optional dict with sentiment category scores.
        reviews: Optional list of individual review dicts.

    Returns:
        Dict with status, source, rating, and hotel_id on success,
        or a dict with an error key on failure.
    """
    try:
        # 1. Record a history snapshot
        db.table("sentiment_history").insert({
            "hotel_id": hotel_id,
            "rating": rating,
            "review_count": review_count,
            "sentiment_breakdown": json.dumps(sentiment_breakdown) if sentiment_breakdown else "[]",
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        # 2. Update the hotels table with latest values
        update_payload: Dict[str, Any] = {"rating": rating}
        if review_count is not None:
            update_payload["review_count"] = review_count
        if sentiment_breakdown is not None:
            update_payload["sentiment_breakdown"] = sentiment_breakdown
        if reviews is not None:
            update_payload["reviews"] = reviews

        db.table("hotels").update(update_payload).eq("id", hotel_id).execute()

        return {
            "status": "saved",
            "source": source,
            "rating": rating,
            "hotel_id": hotel_id,
        }
    except Exception as e:
        logger.error(f"[CopilotService] save_hotel_reputation failed: {e}")
        return {"error": f"Failed to save reputation data: {str(e)}"}

