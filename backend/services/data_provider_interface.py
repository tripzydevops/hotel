from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import date

class HotelDataProvider(ABC):
    """
    Abstract Interface for Hotel Data Providers.
    Ensures all providers (SerpApi, Decodo, RapidAPI) implement the same methods.
    """

    @abstractmethod
    async def fetch_price(
        self, 
        hotel_name: str, 
        location: str, 
        check_in: date, 
        check_out: date, 
        adults: int = 2, 
        currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch price and metadata for a specific hotel.
        
        Returns:
            Dict containing:
            - price (float)
            - currency (str)
            - source (str) - e.g. "Decodo", "SerpApi"
            - url (str)
            - rating (float, optional)
            - reviews (int, optional)
            - amenities (list, optional)
            - sentiment_breakdown (list, optional)
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique name of this provider"""
        pass
