import os
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

load_dotenv()

def sync_from_history():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    print("Fetching Sentiment History for all hotels...")
    # Fetch all history records ordered by date to get the freshest data
    res = supabase.table("sentiment_history").select("hotel_id, review_count, rating, sentiment_breakdown, recorded_at").order("recorded_at", desc=True).execute()
    history = res.data
    
    print(f"Found {len(history)} history records.")
    
    # Track the freshest data per serp_api_id
    latest_by_serp = {}
    
    # We need to map hotel_id to serp_api_id first to use global data
    res_h = supabase.table("hotels").select("id, serp_api_id").execute()
    id_to_serp = {h["id"]: h["serp_api_id"] for h in res_h.data}
    serp_to_id = {h["serp_api_id"]: h["id"] for h in res_h.data if h.get("serp_api_id")}

    for entry in history:
        hid = entry.get("hotel_id")
        sid = id_to_serp.get(hid)
        
        if sid and sid not in latest_by_serp:
            latest_by_serp[sid] = {
                "review_count": entry.get("review_count"),
                "rating": entry.get("rating"),
                "sentiment_breakdown": entry.get("sentiment_breakdown")
            }
    
    print(f"Aggregated latest metadata for {len(latest_by_serp)} unique hotel buildings.")
    
    # Now update the hotels table
    print("Synchronizing hotels table...")
    missing_res = supabase.table("hotels").select("id, name, serp_api_id").execute()
    all_hotels = missing_res.data
    
    count = 0
    for h in all_hotels:
        hid = h["id"]
        sid = h.get("serp_api_id")
        
        # Use serp_api_id to find latest known data globally
        update_source = latest_by_serp.get(sid)
            
        if update_source:
            update_data = {}
            if update_source["review_count"] is not None:
                update_data["review_count"] = update_source["review_count"]
            if update_source["rating"] is not None:
                update_data["rating"] = update_source["rating"]
            if update_source["sentiment_breakdown"]:
                update_data["sentiment_breakdown"] = update_source["sentiment_breakdown"]
                
            if update_data:
                supabase.table("hotels").update(update_data).eq("id", hid).execute()
                count += 1

    print(f"Successfully synchronized {count} hotel records globally.")

if __name__ == "__main__":
    sync_from_history()
