import logging
import os
from typing import Dict, Any, List

from supabase import Client, create_client
import google.generativeai as genai

logger = logging.getLogger(__name__)

from backend.services.auth_service import get_insforge_admin

async def generate_vector_embedding(text: str) -> List[float]:
    """
    Uses Gemini's embedding model to generate a vector for semantic similarity search.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    
    genai.configure(api_key=api_key)
    
    # We use text-embedding-004 from Gemini
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text,
        task_type="retrieval_document"
    )
    return result['embedding']

async def update_persona_and_embedding(user_id: str, persona_data: Any):
    """
    Takes the inferred persona, generates an embedding, and updates the user_profile.
    """
    db = get_insforge_admin()
    
    # Create a semantic description of the user's preferences to embed
    semantic_description = f"Persona: {persona_data.primary_archetype}. " \
                           f"Preferences: {', '.join(persona_data.implied_preferences)}. " \
                           f"Reasoning: {persona_data.reasoning_trace}"
                           
    try:
        embedding = await generate_vector_embedding(semantic_description)
        
        # Update user profile with persona tags and lifestyle embedding
        db.table("user_profiles").update({
            "travel_persona_tags": persona_data.dict(),
            "lifestyle_embedding": embedding,
            "is_cold_start": False # We have solved the cold start!
        }).eq("id", user_id).execute()
        
    except Exception as e:
        logger.error(f"Failed to update user persona and embedding: {e}")

async def get_hotel_recommendations(user_id: str, limit: int = 5) -> List[Dict]:
    """
    Hybrid Search: Matches the user's vector embedding against hotel embeddings
    to recommend hotels based on their inferred behavioral persona.
    """
    db = get_insforge_admin()
    
    try:
        # 1. Fetch User Profile to get their embedding
        res = db.table("user_profiles").select("lifestyle_embedding, is_cold_start").eq("id", user_id).execute()
        if not res.data or not res.data[0].get("lifestyle_embedding"):
            return [] # Still in Cold Start or no embedding available
        
        user_embedding = res.data[0]["lifestyle_embedding"]
        
        # 2. Call the pgvector similarity search RPC function
        # We assume we create an RPC `match_hotels` in Supabase
        rpc_response = db.rpc(
            "match_hotels",
            {
                "query_embedding": user_embedding,
                "match_threshold": 0.5,
                "match_count": limit
            }
        ).execute()
        
        return rpc_response.data
        
    except Exception as e:
        logger.error(f"Failed to fetch hotel recommendations: {e}")
        return []
