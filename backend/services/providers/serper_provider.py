import os
import httpx
from typing import Dict, Any, Optional
from datetime import date
from ..data_provider_interface import HotelDataProvider

class SerperProvider(HotelDataProvider):
    """
    Serper.dev Provider for Google Search Results.
    Fast, JSON-based Scraper.
    """
    
    BASE_URL = "https://google.serper.dev/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SERPER_API_KEY")

    def get_provider_name(self) -> str:
        return "Serper.dev"

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

        # Use Google Shopping Engine via Serper for Price Data
        query = f"{hotel_name} {location} price {check_in.strftime('%Y-%m-%d')} to {check_out.strftime('%Y-%m-%d')}"
        
        payload = {
            "q": query,
            "gl": "tr", # Optimize for local inventory if mostly Turkish hotels? Or make configurable? Default 'us' often hides local OTA prices.
            "hl": "en",
            # "location": location # Optional: "Balikesir, Turkey"
        }
        
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://google.serper.dev/shopping", # SWITCH TO SHOPPING ENDPOINT
                    headers=headers,
                    json=payload,
                    timeout=15.0
                )
                
                if response.status_code != 200:
                    print(f"[Serper] Error {response.status_code}: {response.text}")
                    return None
                
                return self._parse_response(response.json(), hotel_name, currency)

        except Exception as e:
            print(f"[Serper] Exception: {e}")
            return None

    def _parse_response(self, data: Dict[str, Any], target_name: str, currency: str) -> Optional[Dict[str, Any]]:
        # Check 'shopping' list
        shopping = data.get("shopping", [])
        
        if not shopping:
            return None
            
        # Simplistic: Take first result. 
        # Better: Fuzzy match title?
        best_match = shopping[0]
        
        # Extract Price (e.g. "TRY 5,295.00", "$120")
        raw_price = best_match.get("price", "0")
        price_val = 0.0
        
        try:
            # Remove non-numeric chars except dot and comma
            # Handle "5,295.00" -> 5295.00
            clean_str = ''.join(filter(lambda x: x.isdigit() or x in ['.', ','], raw_price))
            # If comma is decimal separator vs thousand separator?
            # Start simple: remove commas, assuming dot is decimal (US/Standard)
            # If "5.295,00" (EU), logic differs. 
            # Serper 'hl=en' usually returns standard format "TRY 5,295.00" -> 5295.00
            
            if ',' in clean_str and '.' in clean_str:
                if clean_str.find(',') < clean_str.find('.'):
                    # 5,295.00 -> Remove comma
                    clean_str = clean_str.replace(',', '')
                else:
                    # 5.295,00 -> Remove dot, swap comma to dot
                    clean_str = clean_str.replace('.', '').replace(',', '.')
            elif ',' in clean_str:
                # 5295,00 -> 5295.00
                clean_str = clean_str.replace(',', '.')
                
            price_val = float(clean_str)
        except:
            price_val = 0.0

        return {
            "price": price_val,
            "currency": currency, # Ideally extract from "TRY" prefix, but we return requested for now
            "vendor": best_match.get("source", "Google Shopping"), # e.g. "Firsat Bu Firsat"
            "source": "Serper.dev",
            "url": best_match.get("link", ""),
            "rating": best_match.get("rating", 0.0), # Shopping usually has rating
            "reviews": best_match.get("reviews", 0),
            "amenities": [],
            "sentiment_breakdown": []
        }
