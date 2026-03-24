
import os
import re
from typing import Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

def clean_price(price: Any, currency: str = "TRY") -> Optional[float]:
    if price is None: return None
    if isinstance(price, (int, float)): return float(price)
    
    clean_str = re.sub(r'[^\d.,]', '', str(price))
    if not clean_str: return None
    
    if "," in clean_str and "." in clean_str:
        if clean_str.rfind(",") > clean_str.rfind("."):
            clean_str = clean_str.replace(".", "").replace(",", ".")
        else:
            clean_str = clean_str.replace(",", "")
    elif "," in clean_str:
        parts = clean_str.split(",")
        if len(parts[-1]) == 3 and len(parts) > 1:
             clean_str = clean_str.replace(",", "")
        else:
             clean_str = clean_str.replace(",", ".")
    elif "." in clean_str:
        parts = clean_str.split(".")
        if len(parts[-1]) == 3 and len(parts) > 1:
             if currency in ["TRY", "EUR", "IDR", "VND"]:
                 clean_str = clean_str.replace(".", "")
    
    try:
        return float(clean_str)
    except ValueError:
        return None

def run_cleanup():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("Supabase credentials missing")
        return

    supabase: Client = create_client(url, key)
    
    # Fetch all logs
    response = supabase.table("price_logs").select("*").execute()
    logs = response.data
    
    print(f"Checking {len(logs)} price logs...")
    updated_count = 0
    
    for log in logs:
        needs_update = False
        updates = {}
        
        # Clean main price (though it should be numeric in DB, sometimes it's saved as null/string if cast failed)
        new_price = clean_price(log.get("price"), log.get("currency", "TRY"))
        if new_price and float(log.get("price") or 0) != new_price:
             updates["price"] = new_price
             needs_update = True
        
        # Clean offers
        offers = log.get("offers") or []
        new_offers = []
        offers_changed = False
        for offer in offers:
            old_p = offer.get("price")
            new_p = clean_price(old_p, log.get("currency", "TRY"))
            if new_p is not None and old_p != new_p:
                new_offers.append({**offer, "price": new_p})
                offers_changed = True
            else:
                new_offers.append(offer)
        
        if offers_changed:
            updates["offers"] = new_offers
            needs_update = True
            
        if needs_update:
            supabase.table("price_logs").update(updates).eq("id", log["id"]).execute()
            updated_count += 1
            if updated_count % 10 == 0:
                print(f"Updated {updated_count} logs...")

    print(f"Done! Cleaned {updated_count} total records.")

if __name__ == "__main__":
    run_cleanup()
