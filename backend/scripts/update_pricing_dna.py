import asyncio
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Fix for module imports in scripts
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.utils.db import get_supabase
from backend.agents.market_intelligence_agent import MarketIntelligenceAgent
from backend.utils.logger import get_logger

logger = get_logger(__name__)

async def update_all_pricing_dna():
    """
    KAIZEN: Operational DNA Backfill.
    Iterates through all user_hotels and updates their strategic persona.
    """
    db = get_supabase(admin=True)
    if not db:
        logger.error("DB connection failed.")
        return

    agent = MarketIntelligenceAgent()
    
    # 1. Fetch all user-hotel mappings
    res = db.table("user_hotels").select("user_id, hotel_id, id").execute()
    mappings = res.data or []
    logger.info(f"Found {len(mappings)} mappings to update.")

    for mapping in mappings:
        mapping_id = mapping["id"]
        hotel_id = mapping["hotel_id"]
        
        logger.info(f"Synthesizing DNA for Mapping {mapping_id} (Hotel: {hotel_id})...")

        try:
            # 2. Fetch history for context
            # Get last 30 days of pricing
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
            
            prices_res = db.table("price_logs")\
                .select("price, recorded_at")\
                .eq("hotel_id", hotel_id)\
                .gte("recorded_at", thirty_days_ago)\
                .order("recorded_at", desc=True)\
                .execute()
                
            sentiment_res = db.table("sentiment_history")\
                .select("rating, recorded_at")\
                .eq("hotel_id", hotel_id)\
                .gte("recorded_at", thirty_days_ago)\
                .order("recorded_at", desc=True)\
                .execute()

            history = {
                "prices": prices_res.data or [],
                "sentiment": sentiment_res.data or []
            }

            if not history["prices"]:
                logger.warning(f"No pricing history for hotel {hotel_id}. Skipping.")
                continue

            # 3. Synthesize DNA
            dna = await agent.synthesize_pricing_dna(history)
            
            # 4. Generate Embedding
            embedding = await agent.generate_strategy_embedding(dna)

            # 5. Update Database
            update_data = {
                "pricing_dna": dna,
                "updated_at": datetime.utcnow().isoformat()
            }
            if embedding:
                update_data["personality_embedding"] = embedding

            db.table("user_hotels")\
                .update(update_data)\
                .eq("id", mapping_id)\
                .execute()

            logger.info(f"Successfully updated DNA for mapping {mapping_id}")

        except Exception as e:
            logger.error(f"Failed to update DNA for mapping {mapping_id}: {e}")

if __name__ == "__main__":
    asyncio.run(update_all_pricing_dna())
