import asyncio
import os
import time
import logging
from typing import List, Dict, Any
from supabase import create_client, Client, ClientOptions
from yarl import URL
from dotenv import load_dotenv

# App imports
import sys
sys.path.append("/home/tripzydevops/hotel")
from backend.utils.embeddings import format_hotel_for_embedding, get_embedding

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load env
load_dotenv("/home/tripzydevops/hotel/.env.local")

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise Exception("Missing Supabase credentials")
    
    supabase = create_client(
        url, 
        key, 
        options=ClientOptions(postgrest_client_timeout=60)
    )
    # Override for insforge
    base = URL(url)
    supabase.postgrest.base_url = base / "api/database/records"
    return supabase

async def heal_specific_ids(supabase: Client, ids: List[str], delay: float = 2.0):
    """Heal a specific list of hotel IDs."""
    logger.info(f"Healing {len(ids)} specific hotels...")
    
    for hid in ids:
        try:
            # Fetch current data
            res = supabase.table("hotel_directory").select("*").eq("id", hid).single().execute()
            hotel = res.data
            if not hotel:
                continue
                
            name = hotel["name"]
            logger.info(f"Heal: {name} ({hid})")
            
            # Format and get embedding
            text = format_hotel_for_embedding(hotel)
            embedding = await get_embedding(text)
            
            if embedding:
                supabase.table("hotel_directory")\
                    .update({"embedding": embedding})\
                    .eq("id", hid).execute()
                logger.info(f"Successfully healed {name}")
            
            await asyncio.sleep(delay)
            
        except Exception as e:
            logger.error(f"Failed to heal {hid}: {e}")
            if "429" in str(e) or "quota" in str(e).lower():
                break

async def main():
    supabase = get_supabase()
    # IDs from SQL query
    target_ids = [
        "89d0f95f-2215-4e42-ae35-5f05e8d2c731", # Swissôtel Resort Bodrum Sahili
        "5d4df731-4c42-422b-865f-3f5b90a04797", # Hotel Balturk Hotel Sakarya
        "1bdb3aeb-e6c9-4d13-89f8-7972b0144570"  # Dedeman Palandoken Hotel
    ]
    await heal_specific_ids(supabase, target_ids, delay=2.0)

if __name__ == "__main__":
    asyncio.run(main())
