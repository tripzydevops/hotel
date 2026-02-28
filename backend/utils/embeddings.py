import os

# from google import genai  # Moved to lazy getter
from typing import List
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

# Configure Gemini Client (Lazy)
_client = None


def get_genai_client():
    global _client
    if _client is None:
        try:
            from google import genai

            api_key = os.getenv("GOOGLE_API_KEY")
            if api_key:
                _client = genai.Client(api_key=api_key)
        except ImportError:
            # Safe for Vercel where google-genai is not installed
            print(
                "[Embedding] Warning: google-genai SDK missing. Using zero-vector fallback."
            )
    return _client


async def get_embedding(text: str, model: str = "gemini-embedding-001") -> List[float]:
    """
    Generates a semantic embedding for the given text using the modern GenAI SDK.
    Uses gemini-embedding-001 which is available for embedContent via the Gemini API.
    """
    client = get_genai_client()
    if not client:
        print(
            "[Embedding] Warning: Gemini Client not initialized. Returning dummy zeros."
        )
        return [0.0] * 768

    try:
        # EXPLANATION: Modern SDK Migration
        # We use the official 'google-genai' SDK as per the gemini-api-dev skill.
        result = client.models.embed_content(
            model=model,
            contents=text,
            config={
                "task_type": "RETRIEVAL_DOCUMENT",
                "title": "Hotel Metadata",
                "output_dimensionality": 768,
            },
        )

        if not result or not result.embeddings:
            return [0.0] * 768

        # EXPLANATION: Dimensionality Match
        # By setting output_dimensionality=768 in the config, we avoid manual slicing
        # and ensure the vector perfectly fits the database schema.
        embedding = result.embeddings[0].values
        return embedding
    except Exception as e:
        print(f"[Embedding] Error generating embedding with modern SDK: {e}")
        return [0.0] * 768


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
