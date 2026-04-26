from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Dict, List, Optional


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
        currency: str = "USD",
        serp_api_id: Optional[str] = None,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Fetch price and metadata for a specific hotel.
        """
        pass

    @abstractmethod
    async def search_hotels(
        self,
        query: str,
        limit: int = 10,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for hotels based on a query string.
        """
        pass

    @abstractmethod
    async def fetch_hotel_info(
        self,
        hotel_id: str,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Fetch detailed information for a specific hotel.
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique name of this provider"""
        pass

    @abstractmethod
    async def get_task_result(
        self,
        task_id: str,
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Retrieve results for a previously submitted task.
        """
        pass
