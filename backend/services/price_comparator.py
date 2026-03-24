"""
Price Comparator Service
Compares new prices against historical data and generates alerts.
"""

from typing import Optional, List, Tuple
from datetime import datetime
from backend.models import TrendDirection, AlertType, PriceWithTrend


class PriceComparator:
    """Service for comparing prices and detecting significant changes."""

    def calculate_trend(
        self,
        current_price: float,
        previous_price: Optional[float],
    ) -> Tuple[TrendDirection, float]:
        """
        Calculate price trend and percentage change.

        Returns:
            Tuple of (TrendDirection, change_percent)
        """
        if previous_price is None or previous_price == 0:
            return TrendDirection.STABLE, 0.0

        change_percent = ((current_price - previous_price) / previous_price) * 100

        if change_percent > 0.5:  # Small buffer for rounding
            return TrendDirection.UP, round(change_percent, 2)
        elif change_percent < -0.5:
            return TrendDirection.DOWN, round(change_percent, 2)
        else:
            return TrendDirection.STABLE, round(change_percent, 2)

    def check_threshold_breach(
        self,
        current_price: float,
        previous_price: float,
        threshold_percent: float,
    ) -> Optional[dict]:
        """
        Check if price change exceeds user's threshold.

        Returns:
            Alert data dict if threshold breached, None otherwise
        """
        if previous_price == 0:
            return None

        change_percent = abs((current_price - previous_price) / previous_price) * 100

        if change_percent >= threshold_percent:
            direction = "increased" if current_price > previous_price else "decreased"
            return {
                "alert_type": AlertType.THRESHOLD_BREACH,
                "message": f"Price {direction} by {change_percent:.1f}% (threshold: {threshold_percent}%)",
                "old_price": previous_price,
                "new_price": current_price,
            }

        return None

    def check_competitor_undercut(
        self,
        target_price: float,
        competitor_name: str,
        competitor_price: float,
        competitor_previous_price: Optional[float] = None,
    ) -> Optional[dict]:
        """
        Check if a competitor is now cheaper than the target hotel.

        Returns:
            Alert data dict if competitor undercuts, None otherwise
        """
        # Only alert if competitor dropped below target
        if competitor_price >= target_price:
            return None

        # Check if this is a NEW undercut (wasn't cheaper before)
        if competitor_previous_price is not None:
            was_already_cheaper = competitor_previous_price < target_price
            if was_already_cheaper:
                return None  # Already knew about this

        difference = target_price - competitor_price
        percent_cheaper = (difference / target_price) * 100

        return {
            "alert_type": AlertType.COMPETITOR_UNDERCUT,
            "message": f"{competitor_name} is now ${difference:.0f} ({percent_cheaper:.1f}%) cheaper than your hotel",
            "old_price": competitor_previous_price,
            "new_price": competitor_price,
        }

    def build_price_with_trend(
        self,
        current_price: float,
        previous_price: Optional[float],
        currency: str = "USD",
        recorded_at: Optional[datetime] = None,
    ) -> PriceWithTrend:
        """Build a PriceWithTrend object from price data."""
        trend, change_percent = self.calculate_trend(current_price, previous_price)

        return PriceWithTrend(
            current_price=current_price,
            previous_price=previous_price,
            currency=currency,
            trend=trend,
            change_percent=change_percent,
            recorded_at=recorded_at or datetime.now(),
        )

    def analyze_all_competitors(
        self,
        target_price: float,
        competitors: List[dict],
        threshold_percent: float,
    ) -> List[dict]:
        """
        Analyze all competitors and generate any necessary alerts.

        Args:
            target_price: Current price of the target hotel
            competitors: List of competitor data with current and previous prices
            threshold_percent: User's alert threshold

        Returns:
            List of alert dicts to be created
        """
        alerts = []

        for comp in competitors:
            name = comp.get("name", "Competitor")
            current = comp.get("current_price")
            previous = comp.get("previous_price")
            hotel_id = comp.get("hotel_id")

            if current is None:
                continue

            # Check threshold breach for this competitor
            if previous is not None:
                threshold_alert = self.check_threshold_breach(
                    current, previous, threshold_percent
                )
                if threshold_alert:
                    threshold_alert["hotel_id"] = hotel_id
                    alerts.append(threshold_alert)

            # Check if competitor undercuts target
            undercut_alert = self.check_competitor_undercut(
                target_price, name, current, previous
            )
            if undercut_alert:
                undercut_alert["hotel_id"] = hotel_id
                alerts.append(undercut_alert)

        return alerts


# Singleton instance
price_comparator = PriceComparator()
