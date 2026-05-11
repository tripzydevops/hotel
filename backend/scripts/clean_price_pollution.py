import asyncio
import os
import statistics
from typing import List, Dict, Any
from backend.utils.db import get_insforge_db
from backend.utils.logger import get_logger
from backend.utils.helpers import convert_currency

logger = get_logger("cleanup_pollution")

async def run_cleanup():
    """
    Identifies and flags anomalous price records stored during currency-mismatched intakes.
    Sets 'is_anomaly=true' on records violating computed median distributions or absolute floors.
    """
    db = get_insforge_db()
    logger.info("Starting global price pollution cleanup")
    
    try:
        # Fetch all hotels.
        res = db.table("hotels").select("id, name, min_price_floor").execute()
        hotels = res.data or []
        logger.info(f"Analyzing price history for {len(hotels)} hotels.")
        
        total_flagged = 0
        
        for hotel in hotels:
            hid = hotel.get("id")
            hotel_name = hotel.get("name")
            if not hid:
                continue

            # The hard floor from database (in TRY theoretically, fallback to 100.0)
            hard_floor = float(hotel.get("min_price_floor") or 100.0)
            
            # Fetch all price logs to calculate distribution. Include currency.
            logs_res = db.table("price_logs") \
                .select("id, price, currency, room_types, check_in_date") \
                .eq("hotel_id", hid) \
                .execute()
            
            all_logs = logs_res.data or []
            if not all_logs:
                continue
            
            # Preprocessing: Normalize all available prices to a common base (TRY) for accurate math
            processed_logs = []
            for log in all_logs:
                raw_price = float(log.get("price") or 0)
                curr = str(log.get("currency") or "TRY")
                if raw_price <= 0:
                    continue
                # Safety: Normalize to TRY so mathematical comparison operates on valid range
                try:
                    norm_price = convert_currency(raw_price, curr, "TRY") if curr != "TRY" else raw_price
                    log["_norm_price"] = norm_price
                    processed_logs.append(log)
                except Exception:
                    # Fallback just in case of helper failure, assume raw is TRY
                    log["_norm_price"] = raw_price
                    processed_logs.append(log)

            if not processed_logs:
                continue
                
            prices = [l["_norm_price"] for l in processed_logs]
            
            # Calculate median to establish dynamic baseline
            median_price = statistics.median(prices)
            
            # Ruleset:
            # 1. Below hard floor (e.g., < 100.0 normalized)
            # 2. Deviates > 3.0x from median (implies severe unit mismatch or garbage data)
            lower_threshold = max(hard_floor, 100.0)
            upper_threshold = median_price * 3.0
            
            flag_ids = []
            
            for log in processed_logs:
                lid = log.get("id")
                norm_price = log["_norm_price"]
                
                # CONDITION 1: Normalized price is below minimum valid floor
                if norm_price < lower_threshold:
                    flag_ids.append(lid)
                    continue
                
                # CONDITION 2: Extreme outlier compared to hotel median
                if norm_price > upper_threshold and len(prices) > 3:
                    flag_ids.append(lid)
                    continue
            
            if flag_ids:
                logger.warning(f"Hotel '{hotel_name}': Found {len(flag_ids)} polluted price logs out of {len(all_logs)}")
                
                # Bulk flag as anomalies
                for chunk_idx in range(0, len(flag_ids), 100):
                    chunk = flag_ids[chunk_idx:chunk_idx+100]
                    db.table("price_logs") \
                        .update({"is_anomaly": True}) \
                        .in_("id", chunk) \
                        .execute()
                
                total_flagged += len(flag_ids)
        
        logger.info(f"Pollution cleanup completed. Total records flagged: {total_flagged}")
        
    except Exception as e:
        logger.error(f"Cleanup script failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(run_cleanup())
