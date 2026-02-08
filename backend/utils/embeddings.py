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

async def get_embedding(text: str, model: str = "models/embedding-001") -> List[float]:
    """Generates a semantic embedding for the given text using Gemini."""
    if not api_key:
        print("[Embedding] Warning: GOOGLE_API_KEY not set. Returning dummy zeros.")
        return [0.0] * 768
        
    try:
        result = genai.embed_content(
            model=model,
            content=text,
            task_type="retrieval_document",
            title="Hotel Metadata"
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
