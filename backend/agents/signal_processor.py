import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from supabase import Client

from backend.services.auth_service import get_insforge_admin

logger = logging.getLogger(__name__)

from backend.agents.persona_agent import infer_travel_persona, TravelPersonaModel
from backend.services.recommendation_engine import update_persona_and_embedding

async def process_pending_signals():
    """
    Background job that polls `user_signals`, aggregates them by user,
    infers their persona, and updates their profile via the Recommendation Engine.
    """
    db = get_insforge_admin()
    
    # 1. Fetch unprocessed signals (e.g., from the last 1 hour)
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    try:
        response = db.table("user_signals") \
            .select("*") \
            .gte("created_at", one_hour_ago) \
            .execute()
        
        signals = response.data
        if not signals:
            logger.info("No new signals to process.")
            return

        # 2. Group signals by user_id
        grouped_signals: Dict[str, List[Dict[str, Any]]] = {}
        for sig in signals:
            uid = sig.get("user_id")
            if not uid: continue # Skip anonymous for now unless we track by session
            
            if uid not in grouped_signals:
                grouped_signals[uid] = []
            grouped_signals[uid].append(sig)

        # 3. Process each user's signals
        for user_id, user_sigs in grouped_signals.items():
            # Only process if they have meaningful interactions (e.g., > 5 signals)
            if len(user_sigs) >= 5:
                logger.info(f"Inferring persona for user {user_id} based on {len(user_sigs)} signals...")
                
                # Infer Persona
                persona: TravelPersonaModel = await infer_travel_persona(user_sigs)
                
                # Update DB via Recommendation Engine
                await update_persona_and_embedding(user_id, persona)
                
                logger.info(f"Successfully processed persona for user {user_id}: {persona.primary_archetype}")

    except Exception as e:
        logger.error(f"Error processing signals: {e}")

if __name__ == "__main__":
    asyncio.run(process_pending_signals())
