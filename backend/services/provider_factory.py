import os
from typing import List
from .data_provider_interface import HotelDataProvider
from .providers.dataforseo_provider import DataForSEOProvider
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class ProviderFactory:
    _providers: List[HotelDataProvider] = []

    @classmethod
    def get_active_providers(cls) -> List[HotelDataProvider]:
        """
        Returns list of active providers in order of priority.
        1. DataForSEO (Primary - Multi-vendor pricing, TRY support)
        """
        if not cls._providers:
            cls._register_providers()
        
        return cls._providers

    @classmethod
    def get_provider(cls, prefer: str = "dataforseo") -> HotelDataProvider:
        """
        Get the most appropriate provider.
        Defaults to DataForSEO.
        """
        if not cls._providers:
            cls._register_providers()

        # Try preferred provider
        target = next((p for p in cls._providers if p.get_provider_name().lower() == prefer.lower()), None)
        if target:
            return target

        # Failover sequence
        if cls._providers:
            return cls._providers[0]

        raise Exception("No providers configured! Check your .env parameters (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD).")

    @classmethod
    def _register_providers(cls):
        # Force clear to prevent zombie instances in persistent processes
        cls._providers = []

        # 1. DataForSEO (Primary)
        df_login = os.getenv("DATAFORSEO_LOGIN")
        df_pass = os.getenv("DATAFORSEO_PASSWORD")
        if df_login and df_pass:
            cls._providers.append(DataForSEOProvider())

    @classmethod
    def get_status_report(cls) -> List[dict]:
        """
        Returns a list of all configured providers and their status.
        Used for Admin Panel.
        """
        # Ensure configured
        if not cls._providers:
            cls._register_providers()

        report = []

        # 1. DataForSEO status (Primary)
        df_provider = next(
            (p for p in cls._providers if isinstance(p, DataForSEOProvider)), None
        )
        if df_provider:
            report.append(
                {
                    "name": "DataForSEO (Task-based)",
                    "type": "Hotel Prices & Meta",
                    "enabled": True,
                    "priority": 1,
                    "limit": "Unlimited (Credit-based)",
                    "refresh": "Background (100-limit batches)",
                    "latency": "Variable (Async Task)",
                    "health": "Active" if df_provider.login else "Error",
                }
            )

        return report

