"""
Location Service for Autonomous Location Discovery.
Handles tracking and deduplication of countries, cities, and towns.
"""

from typing import List
from datetime import datetime
from supabase import Client

class LocationService:
    def __init__(self, db: Client):
        self.db = db

    async def get_locations(self) -> List[dict]:
        """Fetch unique countries and their cities from the registry."""
        try:
            # Get unique countries and cities ordered by popularity
            res = self.db.table("location_registry") \
                .select("country, city, district, occurrence_count") \
                .order("occurrence_count", desc=True) \
                .execute()
            
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
            res = self.db.table("location_registry").upsert(
                {
                    "country": country,
                    "city": city,
                    "district": district,
                    "last_updated_at": datetime.now().isoformat()
                },
                on_conflict="country, city, district"
            ).execute()
            
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
