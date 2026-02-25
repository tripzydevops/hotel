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

        # 1. Real Status from SerpApi Manager
        from backend.services.serpapi_client import serpapi_client
        import asyncio

        try:
            # We use the sync-wrapped get_status from the client for quick report
            detailed = serpapi_client.get_status()
            keys_info = detailed.get("keys_status", [])
            mgr = serpapi_client._key_manager
            
            for i, info in enumerate(keys_info):
                k = mgr._keys[i] if i < len(mgr._keys) else None
                name_meta = ["Primary", "Aşkın Sezen", "Free Tier", "Dynamic Support"]
                name = f"SerpApi Key {i+1} ({name_meta[i]})" if i < len(name_meta) else f"SerpApi Key {i+1}"
                
                # Health logic: "Active" for currently selected index, else Ready/Exhausted
                health = "Ready"
                if i == detailed.get("current_key_index", 0) - 1:
                    health = "Active"
                elif info.get("is_exhausted"):
                    health = "Exhausted"

                report.append({
                    "name": name,
                    "type": "Hotel Prices",
                    "enabled": True,
                    "priority": i + 1,
                    "limit": "250/mo",
                    "refresh": mgr._renewal_info.get(k, "Pending") if k else "Unknown",
                    "latency": "Matched",
                    "health": health
                })
        except Exception as e:
            logger.error(f"Status report fetch error: {e}")
            # Fallback to simple list if manager access fails
            for i in range(1, 5):
                 report.append({
                    "name": f"SerpApi Key {i}",
                    "type": "Hotel Prices",
                    "enabled": bool(os.getenv(f"SERPAPI_API_KEY{'_'+str(i) if i>1 else ''}")),
                    "priority": i,
                    "limit": "250/mo",
                    "refresh": "Pending",
                    "latency": "Error",
                    "health": "Ready"
                })

        return report
