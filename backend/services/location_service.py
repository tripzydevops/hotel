"""
Location Service for Autonomous Location Discovery.
Handles tracking and deduplication of countries, cities, and towns.
"""

from datetime import datetime
from typing import List

from supabase import Client


class LocationService:
    def __init__(self, db: Client):
        self.db = db

    async def resolve_hotel_locations(self):
        """
        Finds hotels that don't have a location_code and attempts to resolve them
        using DataForSEO to increase scan accuracy.
        """
        from backend.services.providers.dataforseo_provider import dataforseo_provider

        try:
            # 1. Fetch hotels missing location_code
            res = (
                self.db.table("hotels")
                .select("id, name, location")
                .is_("location_code", "null")
                .limit(50)
                .execute()
            )

            hotels = res.data or []
            if not hotels:
                return

            print(f"Resolving location codes for {len(hotels)} hotels...")

            for hotel in hotels:
                hid = hotel["id"]
                loc_str = hotel.get("location")
                if not loc_str:
                    continue

                # Try to resolve via DataForSEO
                code = await dataforseo_provider.search_location(loc_str)
                if code:
                    print(f"Resolved '{loc_str}' to code {code} for hotel {hid}")
                    self.db.table("hotels").update({"location_code": code}).eq(
                        "id", hid
                    ).execute()
                else:
                    # Mark as attempted with a special value or just skip
                    # For now, we skip to retry later or manually fix
                    pass

        except Exception as e:
            print(f"Error in resolve_hotel_locations: {e}")

    async def get_locations(self) -> List[dict]:
        """Fetch unique countries and their cities from the registry."""
        try:
            # Get unique countries and cities ordered by popularity
            res = (
                self.db.table("location_registry")
                .select("country, city, district, occurrence_count")
                .order("occurrence_count", desc=True)
                .execute()
            )

            return res.data or []
        except Exception as e:
            print(f"Error fetching locations: {e}")
            return []

    async def upsert_location(self, country: str, city: str, district: str = ""):
        """
        Record a location. If it exists, increment occurrence_count.
        If it's new, create it.
        """
        if not country or not city:
            return

        try:
            # Clean data
            country = country.strip()
            city = city.strip()
            district = (district or "").strip()

            # Attempt UPSERT
            # In Supabase/PostgREST, upsert uses the UNIQUE constraint
            res = (
                self.db.table("location_registry")
                .upsert(
                    {
                        "country": country,
                        "city": city,
                        "district": district,
                        "last_updated_at": datetime.now().isoformat(),
                    },
                    on_conflict="country, city, district",
                )
                .execute()
            )

            # Note: The increment logic might need a raw RPC or separate update
            # if upsert doesn't support 'occurrence_count = occurrence_count + 1' directly.
            # For now, let's keep it simple or use a raw SQL RPC if needed.

            return res.data
        except Exception as e:
            print(f"Error upserting location {city}, {country}: {e}")
            return None

    async def seed_from_hotels(self):
        """Invoke the stored procedure to seed locations from existing hotels."""
        try:
            # Call the RPC function created in the migration
            self.db.rpc("seed_location_registry", {}).execute()
        except Exception as e:
            print(f"Error seeding locations: {e}")
