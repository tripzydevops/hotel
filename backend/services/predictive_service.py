"""
Predictive Yield Service
Calculates market volatility and suggests dynamic alert thresholds based on historical price noise.
"""

import numpy as np
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from supabase import Client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class PredictiveService:
    """Service for AI-driven price prediction and threshold adjustment."""

    async def calculate_market_volatility(
        self, 
        db: Client, 
        hotel_id: UUID, 
        limit: int = 30
    ) -> float:
        """
        Calculate volatility (Standard Deviation of daily price changes) for a hotel.
        
        Returns:
            float: Volatility percentage (0.0 to 100.0)
        """
        try:
            # Fetch recent price logs for this hotel
            # We want daily snapshots to calculate volatility accurately
            res = (
                db.table("price_logs")
                .select("price, recorded_at")
                .eq("hotel_id", str(hotel_id))
                .order("recorded_at", desc=True)
                .limit(limit)
                .execute()
            )

            if not res.data or len(res.data) < 5:
                return 0.0 # Not enough data for volatility

            prices = [row["price"] for row in res.data if row["price"] > 0]
            if len(prices) < 5:
                return 0.0

            # Calculate daily percentage changes
            pct_changes = []
            for i in range(len(prices) - 1):
                prev = prices[i+1]
                curr = prices[i]
                if prev > 0:
                    pct_changes.append(abs((curr - prev) / prev) * 100)

            if not pct_changes:
                return 0.0

            # Volatility is the standard deviation of these changes
            volatility = float(np.std(pct_changes))
            return round(volatility, 2)

        except Exception as e:
            logger.error(f"Volatility calculation failed for {hotel_id}: {e}")
            return 0.0

    def get_smart_threshold(
        self, 
        base_threshold: float, 
        volatility: float, 
        sensitivity: float = 1.0
    ) -> float:
        """
        Apply volatility-aware adjustment to the base threshold.
        
        Formula:
            New Threshold = Base Threshold + (Volatility * Sensitivity)
            
        Args:
            base_threshold: The user's manually set threshold (e.g., 2%)
            volatility: The calculated market noise (e.g., 1.5%)
            sensitivity: Noise suppression multiplier (0.5 to 2.0)
        """
        # We don't want to lower the threshold below the baseline, only suppress noise
        suppression_bonus = (volatility * sensitivity)
        
        # Max cap at 15% to prevent total alert blackout
        smart_threshold = min(base_threshold + suppression_bonus, 15.0)
        
        return round(float(smart_threshold), 2)

# Singleton
predictive_service = PredictiveService()
