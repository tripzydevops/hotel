"""
Import Discovered Hotels Script
Indexes hotels from SerpApi search results into hotel_directory.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(".env")
load_dotenv(".env.local", override=True)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Hotels identified from User's SerpApi search results (including property tokens)
DISCOVERED_HOTELS = [
    {
        "name": "Ramada Residences by Wyndham Balikesir",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
    },
    {
        "name": "Hilton Garden Inn Balikesir",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE",
    },
    {
        "name": "Özdemir Inn Otel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkI4ajI48_avtcEGg0vZy8xMXZtM21nNW5fEAE",
    },
    {
        "name": "GLR OTEL",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIj9D087_f-dFQGg0vZy8xMXZscmI1NDMxEAE",
    },
    {
        "name": "Willmont Hotel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoI87ytpJjZ7eTzARoNL2cvMTFjbmN4cjRfMhAB",
    },
    {
        "name": "Altın Otel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkI0NXi76z7rL9FGg0vZy8xMWMxOTBwMWo4EAE",
    },
    {
        "name": "Anafartalar Hotel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoI29OR3vHJk_yeARoNL2cvMTFwZG5yaGh6NBAB",
    },
    {
        "name": "Otel Mola",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoIysKAt7j_jcL_ARoNL2cvMTFubnM3bGZqbBAB",
    },
    {
        "name": "Elit Asya Hotel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChcIovL45ebCguRvGgsvZy8xdmJfcjRiZxAB",
    },
    {
        "name": "İPEK OTEL",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIhKHdka_ZndQxGg0vZy8xMWMzc3czNzVnEAE",
    },
    {
        "name": "BALIKESİR KARESİ GRUP PANSİYON",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIqvLzup3Xou5cGg0vZy8xMWxuX3p0N3JsEAE",
    },
    {
        "name": "NEF İPEK OTEL",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIh6uU2vK38tigARoML2cvMTJobXA2dHY2EAE",
    },
    {
        "name": "Kılıçaslan Residence",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIy7KG3r6B3bZoGg0vZy8xMWg5a3psMDQ5EAE",
    },
    {
        "name": "Venus Thermal Boutique Hotel & Spa",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChkIyo3k8onn7OhUGg0vZy8xMWZsdDkwNGNwEAE",
    },
    {
        "name": "Asya Pamukçu Termal Otel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChcIlLS8uPr42_htGgsvZy8xdGZjcWp4bBAB",
    },
    {
        "name": "Onhann Thermal Resort Spa Hotel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoItNXo6qWv7MntARoNL2cvMTFmajJsX2d5bRAB",
    },
    {
        "name": "Balıkesir Teacher's Lodge",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChgI5ryM9IjttM7BARoLL2cvMXRkd3h3N2cQAQ",
    },
    {
        "name": "Özdemir Otel",
        "location": "Balikesir, Turkey",
        "serp_api_id": "ChoIj9u7tODTufjqARoNL2cvMTFueG53NDJnZhAB",
    },
]


def import_hotels():
    print(f"Indexing {len(DISCOVERED_HOTELS)} hotels into hotel_directory...")

    total_added = 0

    for hotel in DISCOVERED_HOTELS:
        name = hotel["name"]

        try:
            # Check if exists
            existing = (
                supabase.table("hotel_directory")
                .select("id")
                .eq("name", name)
                .execute()
            )

            if existing.data:
                # Update
                supabase.table("hotel_directory").update(
                    {"serp_api_id": hotel["serp_api_id"]}
                ).eq("name", name).execute()
                print(f"  UPDATED: {name}")
                total_added += 1
            else:
                # Insert
                supabase.table("hotel_directory").insert(hotel).execute()
                print(f"  INSERTED: {name}")
                total_added += 1
        except Exception as e:
            print(f"  ERROR syncing {name}: {e}")

    print(
        f"\nSummary: Successfully synchronized {total_added} hotels with property tokens."
    )


if __name__ == "__main__":
    import_hotels()
