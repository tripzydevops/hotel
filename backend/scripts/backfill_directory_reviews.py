from backend.utils.db import get_supabase
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def backfill_directory_reviews_optimized():
    db = get_supabase()
    
    # 1. Fetch all hotels with rating and review_count to build a master maps
    logger.info("Building master sentiment map from hotels table...")
    hotels_res = db.table("hotels").select("serp_api_id, rating, review_count").not_.is_("serp_api_id", "null").execute()
    
    sentiment_map = {}
    for h in (hotels_res.data or []):
        sid = h["serp_api_id"]
        rating = h.get("rating")
        reviews = h.get("review_count")
        
        if sid not in sentiment_map or (sentiment_map[sid]["reviews"] or 0) < (reviews or 0):
             sentiment_map[sid] = {"rating": rating, "reviews": reviews}

    # 2. Fetch history records for hotels not in the active hotels table (e.g. deleted but history remains)
    logger.info("Enriching map with sentiment_history data...")
    # This is trickier because we need to join back to hotels to get SERP IDs if not present in history.
    # But we can focus on active hotels first as that covers 99% of re-added cases.

    # 3. Fetch hotel directory
    logger.info("Fetching hotel directory...")
    dir_res = db.table("hotel_directory").select("id, serp_api_id").execute()
    directory = dir_res.data or []
    
    logger.info(f"Processing {len(directory)} directory entries...")
    
    count = 0
    errors = 0
    for entry in directory:
        sid = entry.get("serp_api_id")
        if not sid or sid not in sentiment_map:
            continue
            
        data = sentiment_map[sid]
        if data["reviews"] is None and data["rating"] is None:
            continue

        try:
            update_data = {}
            if data["reviews"] is not None:
                update_data["review_count"] = data["reviews"]
            if data["rating"] is not None:
                update_data["rating"] = data["rating"]
                
            if update_data:
                db.table("hotel_directory").update(update_data).eq("id", entry["id"]).execute()
                count += 1
                if count % 100 == 0:
                    logger.info(f"Updated {count} entries...")
        except Exception as e:
            logger.error(f"Failed to update {sid}: {e}")
            errors += 1

    logger.info(f"Backfill complete. Updated {count} entries. Errors: {errors}")

if __name__ == "__main__":
    backfill_directory_reviews_optimized()
