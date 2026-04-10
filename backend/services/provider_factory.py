import os
from typing import List
from .data_provider_interface import HotelDataProvider
from .providers.serpapi_provider import SerpApiProvider
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
        2. SerpApi (Fallback - High fidelity fallback)
        """
        if not cls._providers:
            cls._register_providers()
        
        return cls._providers

    @classmethod
    def get_provider(cls, prefer: str = "dataforseo") -> HotelDataProvider:
        """
        Get the most appropriate provider.
        Defaults to DataForSEO. Falls back to SerpApi if DataForSEO is not configured.
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

        raise Exception("No providers configured! Check your .env parameters (DATAFORSEO_LOGIN, SERPAPI_API_KEY).")

    @classmethod
    def _register_providers(cls):
        # Force clear to prevent zombie instances in persistent processes
        cls._providers = []

        # 1. DataForSEO (Primary - New Default)
        df_login = os.getenv("DATAFORSEO_LOGIN")
        df_pass = os.getenv("DATAFORSEO_PASSWORD")
        if df_login and df_pass:
            cls._providers.append(DataForSEOProvider())

        # 2. SerpApi (Fallback)
        serp_keys = []
        primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
        if primary:
            serp_keys.append(primary)

        # Check for numbered backup keys (up to 10)
        for i in range(2, 11):
            if os.getenv(f"SERPAPI_API_KEY_{i}"):
                serp_keys.append(os.getenv(f"SERPAPI_API_KEY_{i}"))

        if serp_keys:
            cls._providers.append(SerpApiProvider())

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
                    "name": "DataForSEO (Live UI/API)",
                    "type": "Hotel Prices & Meta",
                    "enabled": True,
                    "priority": 1,
                    "limit": "Unlimited (Credit-based)",
                    "refresh": "Real-time",
                    "latency": "Fast (Live)",
                    "health": "Active" if df_provider.login else "Error",
                }
            )

        # 2. SerpApi status (Fallback)
        serp_provider = next(
            (p for p in cls._providers if isinstance(p, SerpApiProvider)), None
        )
        if serp_provider:
            from backend.services.serpapi_client import serpapi_client
            try:
                detailed = serpapi_client.get_status()
                keys_info = detailed.get("keys_status", [])
                mgr = serpapi_client._key_manager

                for i, info in enumerate(keys_info):
                    k = mgr._keys[i] if i < len(mgr._keys) else None
                    name = f"SerpApi Key {i + 1} (FallbackTier)"
                    
                    health = "Ready"
                    if i == detailed.get("current_key_index", 0) - 1:
                        health = "Active"
                    elif info.get("is_exhausted"):
                        health = "Exhausted"

                    report.append(
                        {
                            "name": name,
                            "type": "Hotel Prices",
                            "enabled": True,
                            "priority": 2 + i,
                            "limit": "250/mo",
                            "refresh": mgr._renewal_info.get(k, "Pending") if k else "Unknown",
                            "latency": "Fallback",
                            "health": health,
                        }
                    )
            except Exception as e:
                logger.error(f"SerpApi Status report error: {e}")

        return report
