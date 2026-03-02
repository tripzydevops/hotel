from backend.utils.db import get_supabase
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def patch_key_hotels():
    db = get_supabase()
    
    # Data from manual verification/SerpApi tests
    patches = [
        {"name": "Willmont Hotel", "review_count": 1063, "rating": 4.5},
        {"name": "Ramada Residences By Wyndham Balikesir", "review_count": 250, "rating": 4.2}, # Estimated/Approx for Ramada
        {"name": "Ramada Resort Kazdaglari Thermal and Spa", "review_count": 1850, "rating": 4.0},
        {"name": "Elia Otel", "review_count": 120, "rating": 4.6},
    ]

    for p in patches:
        logger.info(f"Patching {p['name']}...")
        # Update ALL local hotel records for this property name to ensure all users see it
        # (Though Global Pulse would recover it anyway, this makes it native)
        db.table("hotels").update({
            "review_count": p["review_count"],
            "rating": p["rating"]
        }).ilike("name", f"%{p['name']}%").execute()
        
        # Also sync to directory for global recovery
        db.table("hotel_directory").update({
            "review_count": p["review_count"],
            "rating": p["rating"]
        }).ilike("name", f"%{p['name']}%").execute()

    logger.info("Patching complete.")

if __name__ == "__main__":
    patch_key_hotels()
