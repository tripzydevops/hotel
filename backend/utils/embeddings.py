import os
import google.generativeai as genai
from typing import List
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

async def get_embedding(text: str, model: str = "models/gemini-embedding-001") -> List[float]:
    """Generates a semantic embedding for the given text using Gemini."""
    if not api_key:
        print("[Embedding] Warning: GOOGLE_API_KEY not set. Returning dummy zeros.")
        return [0.0] * 768
        
    try:
        result = genai.embed_content(
            model=model,
            content=text,
            task_type="retrieval_document",
            title="Hotel Metadata",
            output_dimensionality=768
        )
        return result['embedding']
    except Exception as e:
        print(f"[Embedding] Error generating embedding: {e}")
        return [0.0] * 768

def format_hotel_for_embedding(hotel: dict) -> str:
    """Formats hotel metadata into a rich string for semantic embedding."""
    name = hotel.get("name", "Unknown")
    stars = hotel.get("stars", "N/A")
    rating = hotel.get("rating", "N/A")
    location = hotel.get("location", "Unknown")
    
    # Extract city context from location string
    city = location.split(",")[0] if "," in location else location
    
    # Enrich with snippets and amenities if available
    snippets = ", ".join(hotel.get("snippets", []))
    amenities = ", ".join(hotel.get("amenities", [])) if isinstance(hotel.get("amenities"), list) else ""
    
    return f"Hotel Name: {name}. Stars: {stars}. Rating: {rating}. City Context: {city}. Full Location: {location}. Amenities: {amenities}. Snippets: {snippets}"


def format_room_type_for_embedding(room: dict, hotel_context: dict = None) -> str:  # type: ignore[assignment]
    """Formats room type metadata into a rich string for semantic embedding.
    
    This creates a language-agnostic semantic representation so that
    'Standart Oda' (TR) matches 'Standard Room' (EN) via cosine similarity.
    
    Args:
        room: Room type dict with keys like 'name', 'price', 'amenities', 'sqm'
        hotel_context: Optional hotel dict for star rating / location context
    """
    name = room.get("name", "Unknown Room")
    price = room.get("price", "N/A")
    currency = room.get("currency", "TRY")
    
    # Extract room attributes from name heuristics
    # These help the embedding understand the room category
    size_hint = ""
    if room.get("sqm"):
        size_hint = f"Size: {room['sqm']}m²."
    
    # Occupancy hints from name
    occupancy = "double"  # default
    name_lower = name.lower()
    if any(kw in name_lower for kw in ["single", "tek", "1 kişi"]):
        occupancy = "single"
    elif any(kw in name_lower for kw in ["triple", "üçlü", "3 kişi"]):
        occupancy = "triple"
    elif any(kw in name_lower for kw in ["family", "aile"]):
        occupancy = "family"
    elif any(kw in name_lower for kw in ["suite", "süit"]):
        occupancy = "suite"
    
    # Category detection
    category = "standard"
    if any(kw in name_lower for kw in ["deluxe", "lüks", "premium"]):
        category = "deluxe"
    elif any(kw in name_lower for kw in ["suite", "süit"]):
        category = "suite"
    elif any(kw in name_lower for kw in ["superior", "üstün"]):
        category = "superior"
    elif any(kw in name_lower for kw in ["economy", "ekonomi", "budget"]):
        category = "economy"
    elif any(kw in name_lower for kw in ["junior"]):
        category = "junior suite"
    elif any(kw in name_lower for kw in ["king", "kral"]):
        category = "king"
    elif any(kw in name_lower for kw in ["presidential", "başkanlık"]):
        category = "presidential"
    
    # Build amenities string
    amenities_list = room.get("amenities", [])
    amenities_str = ", ".join(amenities_list) if isinstance(amenities_list, list) else ""
    
    # Hotel context for better matching
    hotel_str = ""
    if hotel_context:
        stars = hotel_context.get("stars", "N/A")
        location = hotel_context.get("location", "")
        hotel_str = f"Hotel Stars: {stars}. Location: {location}."
    
    return (
        f"Room: {name}. Category: {category}. Occupancy: {occupancy}. "
        f"{size_hint} Price: {price} {currency}. "
        f"Amenities: {amenities_str}. {hotel_str}"
    )
