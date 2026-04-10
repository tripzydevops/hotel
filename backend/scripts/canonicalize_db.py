import json
import os
from backend.utils.db import get_supabase_client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

def canonicalize_hotels():
    """
    1. Identifies duplicate hotels (case-insensitive name match).
    2. Consolidates them into a single canonical record.
    3. Migrates user associations to the canonical record.
    4. Purges mock pricing data (1200/1500 TRY).
    """
    db = get_supabase_client(admin=True)
    
    # Target: Ramada Residences By Wyndham Balikesir
    target_name = "Ramada Residences By Wyndham Balikesir"
    
    logger.info(f"Starting canonicalization for: {target_name}")
    
    # Fetch all hotels to find matches
    res = db.table("hotels").select("*").execute()
    all_hotels = res.data
    
    # Group by name (case-insensitive)
    matches = [h for h in all_hotels if h['name'].lower() == target_name.lower()]
    
    if len(matches) <= 1:
        logger.info("No duplicates found for Ramada.")
    else:
        logger.info(f"Found {len(matches)} duplicates for Ramada.")
        # Sort by last_scanned_at or created_at to find the "best" one
        matches.sort(key=lambda x: x.get('last_scanned_at') or '0', reverse=True)
        canonical_hotel = matches[0]
        duplicates = matches[1:]
        
        canonical_id = canonical_hotel['id']
        logger.info(f"Canonical ID selected: {canonical_id}")
        
        for dup in duplicates:
            dup_id = dup['id']
            logger.info(f"Merging duplicate: {dup_id} -> {canonical_id}")
            
            # 1. Update user_hotels mapping
            # Find all users associated with this duplicate
            user_res = db.table("user_hotels").select("user_id, is_target").eq("hotel_id", dup_id).execute()
            for user_assoc in user_res.data:
                u_id = user_assoc['user_id']
                is_t = user_assoc['is_target']
                
                # Upsert into user_hotels with canonical ID
                db.table("user_hotels").upsert({
                    "user_id": u_id,
                    "hotel_id": canonical_id,
                    "is_target": is_t
                }).execute()
            
            # 2. Move price_logs
            db.table("price_logs").update({"hotel_id": canonical_id}).eq("hotel_id", dup_id).execute()
            
            # 3. Delete duplicate hotel record
            db.table("hotels").delete().eq("id", dup_id).execute()
            logger.info(f"Deleted duplicate hotel record: {dup_id}")

    # --- BATCH PURGE MOCK DATA ---
    logger.info("Starting global batch purge of mock pricing data...")
    res = db.table("hotels").select("id, room_types").execute()
    for hotel in res.data:
        room_types = hotel.get('room_types') or []
        if any(r.get('price') in [1200, 1500] for r in room_types):
            logger.info(f"Sanitizing mock data for hotel: {hotel['id']}")
            # Filter matches
            clean_rooms = [r for r in room_types if r.get('price') not in [1200, 1500]]
            db.table("hotels").update({"room_types": clean_rooms}).eq("id", hotel['id']).execute()

    logger.info("Canonicalization complete.")

if __name__ == "__main__":
    canonicalize_hotels()
