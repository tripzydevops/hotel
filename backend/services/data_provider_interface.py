from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Dict, List, Optional, Tuple


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

    async def get_tasks_bulk(
        self,
        tasks_metadata: List[Dict[str, Any]],
        db: Optional[Any] = None,
        session_id: Optional[str] = None,
    ) -> List[Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]]:
        """
        Retrieve results for multiple tasks in a single bulk request.
        Default implementation falls back to individual calls.
        """
        return [
            await self.get_task_result(
                task_id=meta["external_task_id"],
                db=db,
                session_id=session_id,
                **{k: v for k, v in meta.items() if k not in ["external_task_id"]}
            )
            for meta in tasks_metadata
        ]

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """
        Check if the provider is healthy (credentials valid, API reachable).
        """
        pass
