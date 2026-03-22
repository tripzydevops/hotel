import asyncio
import os
import sys
import json
from supabase import create_client, Client
from backend.utils.db import get_supabase_client

db = get_supabase_client()

profiles_res = db.table("profiles").select("*").execute()
profiles = profiles_res.data or []
target_user = None
for p in profiles:
    if "tripzy" in str(p.get("email", "")).lower() or "tripzy" in str(p.get("full_name", "")).lower():
        target_user = p
        break

if not target_user:
    for p in profiles:
        h_res = db.table("hotels").select("id").eq("user_id", p["id"]).is_("deleted_at", "null").execute()
        if len(h_res.data or []) == 5:
            target_user = p
            break

user_id = target_user["id"]
hotels_res = db.table("hotels").select("name, address, phone, website, email, stars, rating, review_count, amenities").eq("user_id", user_id).execute()

for h in hotels_res.data:
    print(f"\n--- {h.get('name')} ---")
    print(f"Stars: {h.get('stars')} | Rating: {h.get('rating')} ({h.get('review_count')} reviews)")
    print(f"Phone: {h.get('phone')}")
    print(f"Email: {h.get('email')}")
    print(f"Website: {h.get('website')}")
    amenities = h.get('amenities') or []
    print(f"Amenities: {', '.join(amenities[:5])}{'...' if len(amenities) > 5 else ''}")
