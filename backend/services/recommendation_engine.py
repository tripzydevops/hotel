import logging
import os
from typing import Any, Dict, List

from google import genai
from google.genai import types

from backend.services.auth_service import get_insforge_admin

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Embedding Helper
# ---------------------------------------------------------------------------

async def generate_vector_embedding(text: str) -> List[float]:
    """
    Uses Gemini's text-embedding-004 model to generate a 768-dimensional
    vector for semantic similarity search via pgvector.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    result = client.models.embed_content(
        model="models/text-embedding-004",
        contents=text,
        config=types.EmbedContentConfig(task_type="retrieval_document"),
    )
    return result.embeddings[0].values


def _build_hotel_semantic_description(hotel: Dict[str, Any]) -> str:
    """
    Builds a human-readable semantic text profile for a hotel, which is then
    embedded as a vector.  The richer the description, the more accurate the
    ghost competitor discovery will be.

    Pulls from: name, location, star_rating, category, amenities, sentiment
    keywords if available.
    """
    parts = []

    if hotel.get("name"):
        parts.append(f"Hotel: {hotel['name']}.")
    if hotel.get("location"):
        parts.append(f"Location: {hotel['location']}.")
    if hotel.get("star_rating"):
        parts.append(f"Star rating: {hotel['star_rating']} stars.")
    if hotel.get("category"):
        parts.append(f"Category: {hotel['category']}.")
    if hotel.get("amenities"):
        amenities = hotel["amenities"]
        if isinstance(amenities, list):
            parts.append(f"Amenities: {', '.join(str(a) for a in amenities[:10])}.")
        elif isinstance(amenities, str):
            parts.append(f"Amenities: {amenities}.")
    if hotel.get("description"):
        parts.append(f"Description: {str(hotel['description'])[:200]}.")

    return " ".join(parts) if parts else f"Hotel named {hotel.get('name', 'Unknown')}."


# ---------------------------------------------------------------------------
# B2B: Update compset profile in user_profiles
# ---------------------------------------------------------------------------

async def update_compset_profile(user_id: str, profile_data: Any) -> None:
    """
    Persists the inferred CompsetProfileModel to the user_profiles table.
    Writes to the new B2B columns (compset_weights, competitor_blind_spots,
    last_compset_analysis) — does NOT touch the legacy B2C columns.
    """
    from datetime import datetime, timezone

    db = get_insforge_admin()

    try:
        db.table("user_profiles").update(
            {
                "compset_weights": profile_data.model_dump(),
                "competitor_blind_spots": profile_data.blind_spots,
                "last_compset_analysis": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", user_id).execute()

        logger.info(
            f"Updated compset profile for user {user_id}: "
            f"primary_threat={profile_data.primary_threat}"
        )

    except Exception as e:
        logger.error(f"Failed to update compset profile for user {user_id}: {e}")


# ---------------------------------------------------------------------------
# B2B: Ghost Competitor Discovery
# ---------------------------------------------------------------------------

async def discover_ghost_competitors(
    hotel_id: str, limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Semantic Ghost Competitor Discovery (B2B Cold Start Solver).

    When a new hotel is added to HotelPlus and has no manually configured
    compset, this function instantly suggests the most semantically similar
    hotels from the platform's hotel directory using pgvector cosine similarity.

    Workflow:
        1. Fetch the target hotel's data from the `hotels` table.
        2. Build a semantic text description of the hotel.
        3. Generate a Gemini text-embedding-004 vector from that description.
        4. Store the embedding back onto the hotel record for future searches.
        5. Call the `match_hotels` pgvector RPC to find the closest hotels.
        6. Return ranked ghost competitor suggestions.

    This is NOT a B2C recommendation (we are NOT finding hotels for a traveler
    to stay in).  We are finding hotels that are semantically similar to the
    target hotel — i.e., its real competitors.
    """
    db = get_insforge_admin()

    try:
        # 1. Fetch target hotel
        hotel_res = (
            db.table("hotels")
            .select("id, name, location, star_rating, category, amenities, description, embedding")
            .eq("id", hotel_id)
            .single()
            .execute()
        )

        if not hotel_res.data:
            logger.warning(f"Hotel {hotel_id} not found for ghost competitor discovery.")
            return []

        hotel = hotel_res.data

        # 2. Use existing embedding if available, otherwise generate a new one
        hotel_embedding = hotel.get("embedding")

        if not hotel_embedding:
            semantic_description = _build_hotel_semantic_description(hotel)
            logger.info(
                f"Generating embedding for hotel '{hotel.get('name')}': {semantic_description[:80]}..."
            )
            hotel_embedding = await generate_vector_embedding(semantic_description)

            # 3. Persist the embedding for future use
            db.table("hotels").update(
                {
                    "embedding": hotel_embedding,
                    "semantic_description": semantic_description,
                }
            ).eq("id", hotel_id).execute()

        # 4. Run pgvector similarity search — exclude the hotel itself
        rpc_response = db.rpc(
            "match_hotels_simple",
            {
                "query_embedding": hotel_embedding,
                "match_threshold": 0.4,   # lower threshold = more suggestions
                "match_count": limit + 1, # fetch one extra to exclude self
            },
        ).execute()

        competitors = [
            row for row in (rpc_response.data or [])
            if str(row.get("id")) != str(hotel_id)
        ][:limit]

        logger.info(
            f"Ghost competitor discovery for '{hotel.get('name')}': "
            f"found {len(competitors)} suggestions."
        )

        return competitors

    except Exception as e:
        logger.error(f"Ghost competitor discovery failed for hotel {hotel_id}: {e}")
        return []


# ---------------------------------------------------------------------------
# Legacy stub — kept to avoid import errors during transition
# Scheduled for removal in a future cleanup pass.
# ---------------------------------------------------------------------------

# get_hotel_recommendations has been removed as of the May 2026 B2B hardening cycle.
# For B2B competitor discovery, use discover_ghost_competitors(hotel_id) instead.
