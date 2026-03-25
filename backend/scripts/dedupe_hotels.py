import os
import asyncio
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Setup Supabase
load_dotenv()
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

async def comprehensive_data_restoration():
    print("--- Starting Comprehensive Data Restoration ---")
    
    target_user_id = "eb284dd9-7198-47be-acd0-fdb0403bcd0a" # tripzydevops
    
    # 1. Fetch active hotels for the target user
    res = supabase.table("hotels").select("*").eq("user_id", target_user_id).is_("deleted_at", "null").execute()
    active_hotels = res.data or []
    print(f"Active Hotels for tripzydevops: {len(active_hotels)}")
    
    for h in active_hotels:
        h_name = h.get("name")
        h_id = h.get("id")
        serp_id = h.get("serp_api_id")
        
        if not serp_id:
            print(f"  Skipping {h_name} (No SERP ID)")
            continue
            
        print(f"\nProcessing {h_name} ({h_id})...")
        
        # A. Migrate price_logs from OTHER hotel records with SAME serp_id
        # We find any other hotel record (deleted or other user) with the same SERP ID.
        others_res = supabase.table("hotels").select("id").eq("serp_api_id", serp_id).neq("id", h_id).execute()
        other_ids = [oh["id"] for oh in others_res.data or []]
        
        if other_ids:
            print(f"  Found {len(other_ids)} other hotel records for this property.")
            log_res = supabase.table("price_logs").select("id").in_("hotel_id", other_ids).execute()
            other_logs = log_res.data or []
            if other_logs:
                print(f"  Migrating {len(other_logs)} price_logs to active record...")
                for log in other_logs:
                    try:
                        supabase.table("price_logs").update({"hotel_id": h_id}).eq("id", log["id"]).execute()
                    except Exception as e:
                        if "duplicate key value" in str(e):
                            # Already exists in primary, just delete the secondary log
                            supabase.table("price_logs").delete().eq("id", log["id"]).execute()
                        else:
                            raise e

        # B. Migrate query_logs (Legacy) to price_logs
        # We search by SERP ID or Hotel Name (flexible)
        # 2026-02-24: We use Name for query_logs as serp_api_id column might be missing/inconsistent there
        ql_res = supabase.table("query_logs").select("*").ilike("hotel_name", f"%{h_name}%").gte("check_in_date", "2026-01-01").execute()
        legacy_logs = ql_res.data or []
        
        if legacy_logs:
            print(f"  Found {len(legacy_logs)} legacy query_logs. Checking for missing dates...")
            migrated_count = 0
            for l in legacy_logs:
                if l.get("price") is None: continue
                
                # Check if price_log already exists for this date and price
                dup_check = supabase.table("price_logs").select("id").eq("hotel_id", h_id).eq("check_in_date", l["check_in_date"]).eq("price", float(l["price"])).execute()
                
                if not dup_check.data:
                    # Insert into price_logs
                    p_log = {
                        "hotel_id": h_id,
                        "price": float(l["price"]),
                        "currency": l.get("currency") or "TRY",
                        "vendor": l.get("vendor") or "Legacy Import",
                        "source": "legacy_query_log",
                        "check_in_date": l["check_in_date"],
                        "recorded_at": l["created_at"],
                        "is_estimated": True,
                        "serp_api_id": serp_id,
                        "room_types": []
                    }
                    try:
                        supabase.table("price_logs").insert(p_log).execute()
                        migrated_count += 1
                    except Exception as e:
                        if "duplicate key value" in str(e):
                            pass # Skip if already exists for this exact minute
                        else:
                            raise e
            print(f"  Succesfully migrated {migrated_count} legacy records.")

    print("\n--- Data Restoration Complete ---")

if __name__ == "__main__":
    asyncio.run(comprehensive_data_restoration())
