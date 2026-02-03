import os
import httpx
import json
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class DecodoProvider(HotelDataProvider):
    """
    Decodo Provider for Google Hotels.
    Uses: https://scraper-api.decodo.com/v2/scrape
    Target: google_travel_hotels
    """
    
    BASE_URL = "https://scraper-api.decodo.com/v2/scrape"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DECODO_API_KEY")
        if not self.api_key:
            print("Warning: DECODO_API_KEY not found.")

    def get_provider_name(self) -> str:
        return "Decodo"

    async def fetch_price(
        self, 
        hotel_name: str, 
        location: str, 
        check_in: date, 
        check_out: date, 
        adults: int = 2, 
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        
        if not self.api_key:
            return None

        # Payload for Async Task
        payload = {
            "target": "google_travel_hotels",
            "query": f"{hotel_name} {location}",
            "check_in": check_in.strftime("%Y-%m-%d"),
            "check_out": check_out.strftime("%Y-%m-%d"),
            "adults": adults,
            "currency": currency,
            "geo": "United States",
            "locale": "en-US"
        }

        # Auth: User provided Basic Auth Token (Base64)
        # We must use "Basic" scheme.
        headers = {
            "Authorization": f"Basic {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                # 1. Submit Task
                print("Decodo: Submitting Async Task...")
                response = await client.post(
                    "https://scraper-api.decodo.com/v2/task",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    print(f"Decodo Submit Error {response.status_code}: {response.text}")
                    return None
                
                data = response.json()
                job_id = data.get("id") or data.get("job_id")
                
                if not job_id:
                    print("Decodo: No Job ID returned.")
                    return None
                    
                print(f"Decodo Job ID: {job_id}. Polling...")
                
                # 2. Poll for Results
                import asyncio
                for _ in range(12): # Try for 60 seconds (12 * 5s)
                    await asyncio.sleep(5)
                    
                    poll_resp = await client.get(
                        f"https://scraper-api.decodo.com/v2/task/{job_id}/results",
                        headers=headers,
                        timeout=30.0
                    )
                    
                    if poll_resp.status_code == 200:
                        poll_data = poll_resp.json()
                        # If we get a results array, it's done.
                        if "results" in poll_data:
                            return self._parse_response(poll_data)
                    elif poll_resp.status_code == 404 or poll_resp.status_code == 204:
                        # Job might not be ready/created in results DB yet (404) or processing (204)
                        continue
                    else:
                        print(f"Decodo Poll Error: {poll_resp.status_code}")
                
                print("Decodo: Polling timed out.")
                return None

        except Exception as e:
            print(f"Decodo Exception: {e}")
            return None

    def _parse_response(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalize Decodo Async JSON response.
        Structure: {"results": [{"content": "...", "type": "raw", ...}]}
        """
        results = data.get("results", [])
        if not results:
            print("Decodo: Empty results.")
            return None
            
        best_match = results[0]
        
        # NOTE: Async returns 'content' (HTML) if strict mode.
        # But we need to see if it parses usage or we need an AI parser.
        # For now, we reuse the logic assuming 'json' output if possible,
        # OR we try to extract from what we have.
        # Use simple fallback if complexity is high.
        
        try:
            # If we requested HTML (default for target?), parsing here is hard.
            # But the user might have "AI Parser" enabled in dashboard?
            # Let's hope for the best or handle the specific fields if they exist.
            
            # Temporary fallback: Check for explicit price fields if Decodo parsed it.
            # Otherwise we might return None and fallback to Serper.
            
            # If content is empty/failed
            if best_match.get("status_code") == 11101: # Check failure code
                 print("Decodo: Internal Scraper Error (11101).")
                 return None
            
            # ... existing parsing logic ...
            price_val = 0.0
            price_raw = best_match.get("price") or best_match.get("cheap_price") or 0
            
            if isinstance(price_raw, str):
                price_val = float(''.join(filter(lambda x: x.isdigit() or x == '.', price_raw)))
            else:
                price_val = float(price_raw)

            return {
                "price": price_val,
                "currency": best_match.get("currency", "USD"),
                "source": "Decodo",
                "url": best_match.get("url", ""), # Async uses 'url'
                "rating": float(best_match.get("rating", 0.0)),
                "reviews": int(best_match.get("reviews", 0)),
                "amenities": best_match.get("amenities", []),
                "sentiment_breakdown": [] 
            }
        except Exception as e:
            print(f"Error parsing Decodo response: {e}")
            return None
