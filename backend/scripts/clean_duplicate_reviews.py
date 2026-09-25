import hashlib
from collections import defaultdict
from backend.utils.db import get_insforge_db

def compute_fingerprint(hotel_id: str, author: str, text: str) -> str:
    c_text = (text or "").strip().lower()
    c_author = (author or "").strip().lower()
    raw = f"{hotel_id}:{c_author}:{c_text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

def clean_reviews():
    db = get_insforge_db(admin=True)
    print("Fetching all reviews from hotel_reviews...")
    
    # Fetch in batches if necessary
    all_reviews = []
    limit = 1000
    offset = 0
    while True:
        res = db.table("hotel_reviews").select("id, hotel_id, author, text, recorded_at, external_id").range(offset, offset + limit - 1).execute()
        rows = res.data or []
        all_reviews.extend(rows)
        if len(rows) < limit:
            break
        offset += limit
        
    print(f"Total reviews fetched: {len(all_reviews)}")
    
    # Group by (hotel_id, normalized_text)
    grouped = defaultdict(list)
    for r in all_reviews:
        h_id = r.get("hotel_id")
        author = r.get("author") or "Anonymous"
        text = (r.get("text") or "").strip()
        if not text:
            continue
        fp = compute_fingerprint(h_id, author, text)
        grouped[fp].append(r)
        
    print(f"Unique review clusters: {len(grouped)}")
    
    to_delete = []
    to_update_external_id = []
    
    for fp, rows in grouped.items():
        # Sort by recorded_at ascending so oldest is first
        rows.sort(key=lambda x: x.get("recorded_at") or "")
        oldest = rows[0]
        duplicates = rows[1:]
        
        # Keep oldest, set deterministic external_id if needed
        if oldest.get("external_id") != fp:
            to_update_external_id.append((oldest["id"], fp))
            
        for dup in duplicates:
            to_delete.append(dup["id"])
            
    print(f"Oldest unique records to keep: {len(grouped)}")
    print(f"Records to update with deterministic fingerprint: {len(to_update_external_id)}")
    print(f"Duplicate records to delete: {len(to_delete)}")
    
    # Execute external_id updates
    print("Updating fingerprints on retained records...")
    for rid, fp in to_update_external_id:
        db.table("hotel_reviews").update({"external_id": fp}).eq("id", rid).execute()
        
    # Execute batch deletes in chunks of 100
    print(f"Deleting {len(to_delete)} duplicate records in batches...")
    chunk_size = 100
    deleted_count = 0
    for i in range(0, len(to_delete), chunk_size):
        chunk = to_delete[i:i + chunk_size]
        db.table("hotel_reviews").delete().in_("id", chunk).execute()
        deleted_count += len(chunk)
        if deleted_count % 500 == 0 or deleted_count == len(to_delete):
            print(f"Deleted {deleted_count} / {len(to_delete)} duplicates...")
            
    print("Cleanup complete!")
    
    # Final count check
    final_count = db.table("hotel_reviews").select("id", count="exact").execute()
    print(f"Remaining verified unique reviews in DB: {final_count.count}")

if __name__ == "__main__":
    clean_reviews()
