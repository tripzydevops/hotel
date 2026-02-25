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
        primary = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
        if primary: serp_keys.append(primary)
        
        # Check for numbered backup keys (up to 10)
        for i in range(2, 11):
            if os.getenv(f"SERPAPI_API_KEY_{i}"):
                serp_keys.append(os.getenv(f"SERPAPI_API_KEY_{i}"))
        
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
        
        # Determine which key is actually active from the SerpApiProvider instance
        active_key_index = 0
        serp_provider = next((p for p in cls._providers if isinstance(p, SerpApiProvider)), None)
        if serp_provider:
            active_key_index = serp_provider.get_active_key_index()

        # Mock Usage Data (In a real app, this would come from a DB)
        from datetime import date, timedelta
        
        # 1. SerpApi Key 1 (Primary)
        report.append({
            "name": "SerpApi Key 1 (Primary)",
            "type": "Hotel Prices",
            "enabled": bool(os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")),
            "priority": 1,
            "limit": "250/mo",
            "refresh": "Mar 05", 
            "latency": "1.2s",
            "health": "Active" if active_key_index == 0 else "Ready"
        })

        # 2. SerpApi Key 2 (Aşkın Sezen)
        report.append({
            "name": "SerpApi Key 2 (Aşkın Sezen)", 
            "type": "Hotel Prices",
            "enabled": bool(os.getenv("SERPAPI_API_KEY_2")),
            "priority": 2,
            "limit": "250/mo",
            "refresh": "Mar 23",
            "latency": "0.8s",
            "health": "Active" if active_key_index == 1 else "Ready"
        })

        # 3. SerpApi Key 3 (Free Tier)
        report.append({
            "name": "SerpApi Key 3 (Free Tier)",
            "type": "General Search",
            "enabled": bool(os.getenv("SERPAPI_API_KEY_3")),
            "priority": 3,
            "limit": "250/mo",
            "refresh": "Mar 04",
            "latency": "Pending",
            "health": "Active" if active_key_index == 2 else "Ready"
        })

        # 4. SerpApi Key 4 (Dynamic Support)
        report.append({
            "name": "SerpApi Key 4",
            "type": "Hotel Prices",
            "enabled": bool(os.getenv("SERPAPI_API_KEY_4")),
            "priority": 4,
            "limit": "250/mo",
            "refresh": "Mar 25",
            "latency": "Pending",
            "health": "Active" if active_key_index == 3 else "Ready"
        })
        
        return report
