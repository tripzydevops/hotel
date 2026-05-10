
import asyncio
import os
import statistics
from typing import List, Dict, Any
from backend.utils.db import get_insforge_db
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Keywords that justify significantly higher prices
PREMIUM_ROOM_KEYWORDS = {
    "suite", "king", "deluxe", "villa", "president", "exec", 
    "suit", "superior", "premium", "junior", "family", "grand"
}

def is_premium_room(room_types: list) -> bool:
    """Checks if any room in the list has a premium keyword in its name."""
    if not room_types:
        return False
    
    for rt in room_types:
        name = str(rt.get("name") or rt.get("original_name") or "").lower()
        if any(keyword in name for keyword in PREMIUM_ROOM_KEYWORDS):
            return True
    return False

async def clean_pollution():
    """
    1. Finds and deletes price logs below the hotel's floor or global absolute minimum.
    2. Identifies and cleans high price outliers (> 2.5x median) UNLESS they are explicitly premium rooms (Suites, etc).
    """
    db = get_insforge_db(admin=True)
    if not db:
        logger.error("Failed to initialize DB client.")
        return
    
    # 1. Fetch all hotels
    logger.info("Fetching hotels data...")
    res = db.table("hotels").select("id, name, min_price_floor").execute()
    hotels = res.data or []
    
    total_purged = 0
    
    for hotel in hotels:
        hid = hotel["id"]
        name = hotel["name"]
        floor = float(hotel["min_price_floor"]) if hotel.get("min_price_floor") else 0
        
        logger.info(f"Analyzing '{name}'...")
        
        # Fetch all price logs to calculate distribution
        logs_res = db.table("price_logs") \
            .select("id, price, room_types, check_in_date") \
            .eq("hotel_id", hid) \
            .execute()
        
        all_logs = logs_res.data or []
        if not all_logs:
            continue
            
        prices = [float(l["price"]) for l in all_logs if l.get("price")]
        if not prices:
            continue
            
        median_price = statistics.median(prices)
        # Dynamic upper threshold to detect extreme outliers (2.5x typical price)
        upper_threshold = median_price * 2.5
        
        # Intelligent lower bound: Max of (user floor, absolute system minimum, OR 30% of hotel median)
        # This dynamically catches the 106.0 price for a 4000 median hotel.
        dynamic_floor = median_price * 0.3 if median_price > 500 else 100.0
        lower_threshold = max(floor, 100.0, dynamic_floor)
        
        logger.info(f"  - Stats: Median={median_price:.2f}, Range=[{min(prices)}, {max(prices)}]")
        logger.info(f"  - Filtering logic: LowerBound={lower_threshold}, UpperBound={upper_threshold:.2f} (Unless Suite)")
        
        bad_logs = []
        
        for log in all_logs:
            price = float(log.get("price") or 0)
            room_types = log.get("room_types") or []
            
            # CONDITION 1: Price is below minimum valid floor
            if price < lower_threshold:
                bad_logs.append(log)
                logger.warning(f"    - Caught Low Pollution: Price={price} (Below {lower_threshold})")
                continue
            
            # CONDITION 2: Price is excessively high AND it's NOT a premium room
            if price > upper_threshold:
                if not is_premium_room(room_types):
                    bad_logs.append(log)
                    logger.warning(f"    - Caught High Pollution: Price={price} (Above {upper_threshold:.2f} & No Suite keyword found). RoomTypes: {room_types}")
                else:
                    logger.info(f"    - Preserved Premium Pricing: Price={price} justified by RoomType verification.")
        
        if bad_logs:
            log_ids = [l["id"] for l in bad_logs]
            logger.warning(f"  -> PURGING {len(bad_logs)} polluted logs for '{name}'...")
            try:
                # Perform purge in chunks of 100 just in case
                for i in range(0, len(log_ids), 100):
                    chunk = log_ids[i:i+100]
                    db.table("price_logs").delete().in_("id", chunk).execute()
                total_purged += len(log_ids)
                logger.info(f"  -> Successfully purged {len(log_ids)} logs.")
            except Exception as e:
                logger.error(f"  -> Failed to purge logs for '{name}': {e}")
                
    logger.info(f"✅ Pollution cleaning complete. Total logs purged: {total_purged}")

if __name__ == "__main__":
    asyncio.run(clean_pollution())
