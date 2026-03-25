
import asyncio
import json
import sys
import os
from typing import List, Dict, Any, cast

# Add current dir to path to import backend
sys.path.append(os.getcwd())

from backend.utils.embeddings import get_embedding

def format_hotel_for_embedding(hotel: Dict[str, Any]) -> str:
    name = str(hotel.get("name", "Unknown Hotel"))
    stars = str(hotel.get("stars", "?"))
    rating = str(hotel.get("rating", "?"))
    location = str(hotel.get("location", "Unknown Location"))
    description = str(hotel.get("description") or "")
    
    amenities_data = hotel.get("amenities") or []
    if isinstance(amenities_data, list):
        amenities_str = ", ".join([str(a) for a in amenities_data])
    else:
        amenities_str = str(amenities_data)
    
    reviews_data = hotel.get("reviews") or []
    reviews_text = ""
    if isinstance(reviews_data, list):
        snippets: List[str] = []
        top_reviews = cast(List[Any], reviews_data)[:3]
        for r in top_reviews:
            if isinstance(r, dict):
                text = r.get("title") or r.get("snippet") or r.get("text")
                if text: snippets.append(f"\"{text}\"")
            elif isinstance(r, str):
                snippets.append(f"\"{r}\"")
        reviews_text = " ".join(snippets)

    return f"Hotel Name: {name}. Stars: {stars}. Rating: {rating}. Location: {location}. Description: {description}. Amenities: {amenities_str}. Reviews: {reviews_text}"

async def main():
    # Read the JSON from a file passed as argument
    if len(sys.argv) < 2:
        print("Usage: python process_batch.py <input_json_file>")
        return

    input_file = sys.argv[1]
    with open(input_file, 'r') as f:
        data = json.load(f)

    # Handle the structure returned by run-raw-sql tool (sometimes it's wrapped)
    rows = data.get("rows", [])
    if not rows and isinstance(data, list):
        rows = data

    print(f"-- Processing {len(rows)} hotels", file=sys.stderr)
    
    for row in rows:
        try:
            profile = format_hotel_for_embedding(row)
            embedding = await get_embedding(profile)
            
            if embedding and any(v != 0.0 for v in embedding):
                # Format embedding as Postgres vector string [v1,v2,...]
                vector_str = "[" + ",".join(map(str, embedding)) + "]"
                sql = f"UPDATE public.hotel_directory SET embedding = '{vector_str}'::vector WHERE id = '{row['id']}';"
                print(sql)
            else:
                print(f"-- Warning: Failed to generate embedding for {row['name']}", file=sys.stderr)
        except Exception as e:
            print(f"-- Error processing {row.get('name', 'ID:'+row['id'])}: {e}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
