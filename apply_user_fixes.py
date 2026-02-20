import asyncio
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta

load_dotenv("/home/successofmentors/.gemini/antigravity/scratch/hotel/.env")

async def apply_fixes():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    uid = "eb284dd9-7198-47be-acd0-fdb0403bcd0a" # tripzydevops
    
    # 1. Update settings (frequency to 60)
    print(f"Updating settings for {uid}...")
    supabase.table("settings").update({"check_frequency_minutes": 60}).eq("user_id", uid).execute()
    
    # 2. Update profiles (next_scan_at to now + short offset to avoid overlap with fix)
    next_run = datetime.now(timezone.utc) + timedelta(minutes=5)
    next_run_iso = next_run.isoformat().replace("+00:00", "Z")
    print(f"Updating profile next_scan_at to {next_run_iso}...")
    supabase.table("profiles").update({
        "next_scan_at": next_run_iso,
        "scan_frequency_minutes": 60
    }).eq("id", uid).execute()
    
    print("Database updates complete.")

if __name__ == "__main__":
    asyncio.run(apply_fixes())
