import os
import logging

# from google import genai  # Moved to lazy getter
from typing import List

# Environment is loaded centrally via db.load_env_standard()
# No redundant load_dotenv() call needed here.

logger = logging.getLogger(__name__)

from backend.utils.ai_client import get_genai_client


async def get_embedding(
    text: str, model: str = "models/text-embedding-004"
) -> List[float]:
    """
    Generates a semantic embedding for the given text using the modern GenAI SDK.
    KAİZEN: Always use stable embedding models. As per project 'gemini-api-dev' skill,
    Gemini 3 models are the standard. DO NOT use legacy models.
    """
    embeddings = await get_embeddings_batch([text], model=model)
    return embeddings[0]


async def get_embeddings_batch(
    texts: List[str], model: str = "models/text-embedding-004"
) -> List[List[float]]:
    """
    Generates multiple semantic embeddings in batches using the modern GenAI SDK.
    This prevents API timeouts and payload limit issues for large datasets.
    """
    client = get_genai_client()
    if not client or not texts:
        return [[0.0] * 768 for _ in texts]

    try:
        all_embeddings = []
        chunk_size = 100  # API usually limits batches, 100 is safe

        for i in range(0, len(texts), chunk_size):
            chunk = texts[i : i + chunk_size]
            result = client.models.embed_content(
                model=model,
                contents=chunk,
                config={
                    "task_type": "RETRIEVAL_DOCUMENT",
                    "output_dimensionality": 768,
                },
            )

            if not result or not result.embeddings:
                logger.warning(
                    "Embedding failed for chunk starting at %d", i
                )
                all_embeddings.extend([[0.0] * 768 for _ in chunk])
                continue

            all_embeddings.extend([emb.values for emb in result.embeddings])

        return all_embeddings
    except Exception as e:
        logger.error("Batch embedding error with chunking: %s", e)
        return [[0.0] * 768 for _ in texts]


def format_hotel_for_embedding(hotel: dict) -> str:
    """Formats hotel metadata into a rich string for semantic embedding."""
    name = hotel.get("name", "Unknown")
    stars = hotel.get("stars", "N/A")
    rating = hotel.get("rating", "N/A")
    location = hotel.get("location", "Unknown")
    city = location.split(",")[0] if "," in location else location
    snippets = ", ".join(hotel.get("snippets", []))
    amenities = (
        ", ".join(hotel.get("amenities", []))
        if isinstance(hotel.get("amenities"), list)
        else ""
    )
    return f"Hotel Name: {name}. Stars: {stars}. Rating: {rating}. City Context: {city}. Full Location: {location}. Amenities: {amenities}. Snippets: {snippets}"


def format_room_type_for_embedding(room: dict, hotel_context: dict = None) -> str:
    """Formats room type metadata into a rich string for semantic embedding."""
    name = room.get("name", "Unknown Room")
    price = room.get("price", "N/A")
    currency = room.get("currency", "TRY")
    size_hint = f"Size: {room['sqm']}m²." if room.get("sqm") else ""

    name_lower = name.lower()
    occupancy = "double"
    if any(kw in name_lower for kw in ["single", "tek", "1 kişi"]):
        occupancy = "single"
    elif any(kw in name_lower for kw in ["triple", "üçlü", "3 kişi"]):
        occupancy = "triple"
    elif any(kw in name_lower for kw in ["family", "aile"]):
        occupancy = "family"
    elif any(kw in name_lower for kw in ["suite", "süit"]):
        occupancy = "suite"

    category = "standard"
    if any(kw in name_lower for kw in ["deluxe", "lüks", "premium"]):
        category = "deluxe"
    elif any(kw in name_lower for kw in ["suite", "süit"]):
        category = "suite"
    elif any(kw in name_lower for kw in ["superior", "üstün"]):
        category = "superior"
    elif any(kw in name_lower for kw in ["economy", "ekonomi", "budget"]):
        category = "economy"

    amenities_list = room.get("amenities", [])
    amenities_str = (
        ", ".join(amenities_list) if isinstance(amenities_list, list) else ""
    )

    hotel_str = ""
    if hotel_context:
        stars = hotel_context.get("stars", "N/A")
        location = hotel_context.get("location", "")
        hotel_str = f"Hotel Stars: {stars}. Location: {location}."

    return f"Room: {name}. Category: {category}. Occupancy: {occupancy}. {size_hint} Price: {price} {currency}. Amenities: {amenities_str}. {hotel_str}"
