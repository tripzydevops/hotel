import os
from supabase import create_client

def populate_balikesir_metadata():
    url = "https://ztwkdawfdfbgusskqbns.supabase.co"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not found.")
        return
    
    db = create_client(url, key)
    
    # 1. Coordinate Map for major Balikesir hotels
    geo_map = {
        "Ramada Residences By Wyndham Balikesir": {"lat": 39.6372, "lng": 27.8896, "price": 4750},
        "Hilton Garden Inn Balikesir": {"lat": 39.6449, "lng": 27.8793, "price": 5400},
        "Willmont Hotel": {"lat": 39.6590, "lng": 27.8458, "price": 5271},
        "Onhann Thermal Resort": {"lat": 39.5401, "lng": 28.0229, "price": 4500},
        "Hotel Asya": {"lat": 39.6484, "lng": 27.8847, "price": 3800},
        "Serel Hotel": {"lat": 39.6412, "lng": 27.8921, "price": 3200},
        "Hotel Grand Yilmaz": {"lat": 39.6475, "lng": 27.8858, "price": 3500}
    }
    
    print("Populating Balikesir Metadata...")
    
    # Update Tracked Hotels
    res = db.table("hotels").select("id, name").ilike("location", "%Balikesir%").execute()
    tracked = res.data or []
    
    for h in tracked:
        match = next((v for k, v in geo_map.items() if k.lower() in h["name"].lower()), None)
        if match:
            db.table("hotels").update({
                "latitude": match["lat"],
                "longitude": match["lng"],
                "current_price": match["price"],
                "currency": "TRY"
            }).eq("id", h["id"]).execute()
            print(f"Updated Tracked: {h['name']}")

    # Update Global Directory (to fix "0 Mapped")
    dir_res = db.table("hotel_directory").select("id, name").ilike("location", "%Balikesir%").execute()
    directory = dir_res.data or []
    
    for h in directory:
        match = next((v for k, v in geo_map.items() if k.lower() in h["name"].lower()), None)
        if match:
            db.table("hotel_directory").update({
                "latitude": match["lat"],
                "longitude": match["lng"]
            }).eq("id", h["id"]).execute()
            # print(f"Updated Directory: {h['name']}")

if __name__ == "__main__":
    populate_balikesir_metadata()
