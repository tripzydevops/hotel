
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")
load_dotenv(".env.local", override=True)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Data from User's JSON
KNOWN_IDS = {
    "Ramada Resort By Wyndham Kazdaglari Thermal And Spa": "ChkIm4PAj4KStPV1Gg0vZy8xMWNsenIxX3gxEAE",
    "Orion Adatepe": "ChkQ_oe-zM6C5Kx5Gg0vZy8xMXljbDF4NDJtEAI",
    "Asil Apart Hotel": "ChkQ3-3x64XA4-U8Gg0vZy8xMXkzeWZya3B4EAI",
    "Mavras Tas Odalar": "ChoQzrf357uP7pvgARoNL2cvMTF5bHE5Zmg2cxAC",
    "Eva Lavanda Kazdağları": "ChkQ8rWbyoC0n8EpGg0vZy8xMW1zdHd0ZHdtEAI",
    "Altinoluk Otel": "ChoQ0eu0x_ahrs2yARoNL2cvMTF5ZDlwcTd4YxAC",
    "Güneş Otel": "ChkQl7i9ofCPv6oyGg0vZy8xMW1rX3Qwd2p2EAI",
    "Ramada Residences By Wyndham Balikesir": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
    "Altın Otel": "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE",
    "Altın Otel & Spa Balıkesir": "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE",
    "Hilton Garden Inn Balikesir": "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE",
    "Willmont Hotel": "ChoI87ytpJjZ7eTzARoNL2cvMTFjbmN4cjRfMhAB"
}

def sync_ids():
    print("Fetching all hotels...")
    response = supabase.table("hotels").select("*").execute()
    hotels = response.data
    
    updates = 0
    for hotel in hotels:
        name = hotel["name"].strip()
        current_id = hotel.get("serp_api_id")
        
        # Try exact match
        found_id = KNOWN_IDS.get(name)
        
        # Try fuzzy/partial match if exact failed
        if not found_id:
            for k, v in KNOWN_IDS.items():
                if k in name or name in k:
                    # Simple safety check: lengths shouldn't be too different
                    if abs(len(k) - len(name)) < 10:
                        found_id = v
                        print(f"Fuzzy key match: '{name}' matched with '{k}'")
                        break
        
        if found_id:
            if current_id != found_id:
                print(f"UPDATING {name}: {current_id} -> {found_id}")
                supabase.table("hotels").update({"serp_api_id": found_id}).eq("id", hotel["id"]).execute()
                updates += 1
            else:
                print(f"Verified {name}: ID already set.")
        else:
            print(f"No ID found for {name} in known list.")

    print(f"\nCompleted. Updated {updates} hotels.")

if __name__ == "__main__":
    sync_ids()
