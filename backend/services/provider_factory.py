import os
from typing import List
from .data_provider_interface import HotelDataProvider
from .providers.serpapi_provider import SerpApiProvider 

class ProviderFactory:
    _providers: List[HotelDataProvider] = []
    
    @classmethod
    def get_active_providers(cls) -> List[HotelDataProvider]:
        """Returns list of all active providers sorted by priority."""
        if not cls._providers:
            cls._register_providers()
        return cls._providers

    @classmethod
    def get_provider(cls, prefer: str = "primary") -> HotelDataProvider:
        """
        Get the most appropriate provider.
        """
        if not cls._providers:
            cls._register_providers()
            
        # Default to First Available (SerpApi)
        if cls._providers:
            return cls._providers[0]
            
        raise Exception("No providers configured! Check your .env parameters.")
        
    @classmethod
    def _register_providers(cls):
        # Force clear to prevent zombie instances in persistent processes
        cls._providers = []
        
        # 1. SerpApi (Primary - High Fidelity)
        serp_keys = []
        if os.getenv("SERPAPI_API_KEY"): serp_keys.append(os.getenv("SERPAPI_API_KEY"))
        if os.getenv("SERPAPI_KEY"): serp_keys.append(os.getenv("SERPAPI_KEY"))
        if os.getenv("SERPAPI_API_KEY_2"): serp_keys.append(os.getenv("SERPAPI_API_KEY_2"))
        
        if serp_keys:
            cls._providers.append(SerpApiProvider())

        # Alternative providers (RapidAPI, Serper, Decodo) are decommissioned 
        # as per user request to restore original SerpApi fidelity.
        pass
            
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
        
        # 1. SerpApi - Primary
        report.append({
            "name": "SerpApi",
            "type": "Primary (Google Hotels)",
            "enabled": bool(os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY") or os.getenv("SERPAPI_API_KEY_2")),
            "priority": 1,
            "limit": "100 / mo (Free)",
            "refresh": "Monthly"
        })
        
        return report
