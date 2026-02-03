import asyncio
import httpx
import json
from datetime import date, timedelta

# API Key provided by user
API_KEY = "f9a8675e91mshfc0f61ccb46f1e2p10f1a3jsn4fa9c5fed8a6"
HOST = "booking-com15.p.rapidapi.com"

headers = {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": HOST,
    "Content-Type": "application/json"
}

async def debug_rapidapi():
    async with httpx.AsyncClient() as client:
        print("--- 1. Searching for Hotel Specifics ---")
        
        # Test finding specific hotel directly
        location_query = "Hilton Garden Inn Balikesir" 
        url_loc = "https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination" 
        params_loc = {"query": location_query}
        
        resp_loc = await client.get(url_loc, headers=headers, params=params_loc)
        print(f"Location Status: {resp_loc.status_code}")
        
        if resp_loc.status_code != 200:
            print(f"Error: {resp_loc.text}")
            return

        loc_data = resp_loc.json()
        
        # Extract list from dict if needed
        locations = []
        if isinstance(loc_data, list):
            locations = loc_data
        elif isinstance(loc_data, dict):
            if "data" in loc_data:
                locations = loc_data["data"]
            elif "result" in loc_data:
                locations = loc_data["result"]
        
        print(f"Found {len(locations)} locations.")
        
        dest_id = None
        search_type = None
        
        for item in locations:
            name = item.get("name")
            dest_type = item.get("dest_type")
            d_id = item.get("dest_id")
            
            print(f" - {name} ({dest_type}) ID: {d_id}")
            
            if item.get("dest_type") == "hotel":
                 dest_id = d_id
                 search_type = dest_type
                 print(f"Selected Hotel ID: {dest_id}")
                 break
        
        if not dest_id and locations:
             # Fallback
             print("Using fallback (first result)")
             dest_id = locations[0].get("dest_id")
             search_type = locations[0].get("dest_type")

        if not dest_id:
            print("No destination found (dest_id is None).")
            return

        print(f"\n--- 2. Searching Hotels in Dest ID: {dest_id} ---")
        
        check_in = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
        check_out = (date.today() + timedelta(days=31)).strftime("%Y-%m-%d")
        
        url_search = f"https://{HOST}/api/v1/hotels/searchHotels"
        params_search = {
            "dest_id": dest_id,
            "search_type": search_type,
            "arrival_date": check_in,
            "departure_date": check_out,
            "adults": "2",
            # "page_number": "0", # Caused "Invalid value" error
            "units": "metric",
            "temperature_unit": "c",
            "languagecode": "en-us",
            "currency_code": "USD"
        }
        
        resp_search = await client.get(url_search, headers=headers, params=params_search)
        print(f"Search Status: {resp_search.status_code}")
        
        if resp_search.status_code == 200:
            search_data = resp_search.json()
            
            with open("rapidapi_debug.json", "w", encoding="utf-8") as f:
                json.dump(search_data, f, indent=2)
                
            hotel_list = []
            if "data" in search_data and "hotels" in search_data["data"]:
                hotel_list = search_data["data"]["hotels"]
            elif "result" in search_data:
                 hotel_list = search_data["result"]
            
            print(f"Hotels Found: {len(hotel_list)}")
            
            for h in hotel_list:
                prop = h.get("property", h)
                name = prop.get("name", "Unknown")
                
                # Try to find price
                price = "N/A"
                if "priceBreakdown" in prop:
                    price = prop["priceBreakdown"].get("grossPrice", {}).get("value")
                
                print(f" - Found: {name} (Price: {price})")

        else:
            print(f"Error: {resp_search.text}")

if __name__ == "__main__":
    asyncio.run(debug_rapidapi())
