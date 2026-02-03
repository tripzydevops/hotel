import os
from typing import List
from .data_provider_interface import HotelDataProvider
from .providers.decodo_provider import DecodoProvider
from .providers.serpapi_provider import SerpApiProvider 
from .providers.serper_provider import SerperProvider
from .providers.rapidapi_provider import RapidApiProvider

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
            
        if prefer == "secondary":
             for p in cls._providers:
                 if isinstance(p, SerperProvider): return p

        if prefer == "tertiary":
             for p in cls._providers:
                 if isinstance(p, SerpApiProvider): return p
        
        # Default to First Available
        if cls._providers:
            return cls._providers[0]
            
        raise Exception("No providers configured! Check your .env parameters.")
        
    @classmethod
    def _register_providers(cls):
        # 1. Serper.dev (Primary - Stable)
        if os.getenv("SERPER_API_KEY"):
            cls._providers.append(SerperProvider())

        # 2. SerpApi (Secondary - Reliable)
        if os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY"):
            cls._providers.append(SerpApiProvider())

        # 3. Decodo (Backup - High Quota but Unstable)
        if os.getenv("DECODO_API_KEY"):
            cls._providers.append(DecodoProvider())
            
        # 4. RapidApi (Supplementary -> Primary for Prices)
        rapid_key = os.getenv("RAPIDAPI_KEY")
        if rapid_key:
            cls._providers.append(RapidApiProvider(rapid_key))
            
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
        
        # 1. Serper
        report.append({
            "name": "Serper.dev",
            "type": "Primary (JSON Search)",
            "enabled": bool(os.getenv("SERPER_API_KEY")),
            "priority": 1,
            "limit": "2,500 / mo",
            "refresh": "Monthly"
        })

        # 2. SerpApi
        report.append({
            "name": "SerpApi",
            "type": "Secondary (Legacy)",
            "enabled": bool(os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")),
            "priority": 2,
            "limit": "100 / mo (Free)",
            "refresh": "Monthly"
        })

        # 3. Decodo
        report.append({
            "name": "Decodo",
            "type": "Backup (Google Hotels)",
            "enabled": bool(os.getenv("DECODO_API_KEY")),
            "priority": 3,
            "limit": "2,500 / mo (Unstable)",
            "refresh": "Monthly (1st)"
        })
        
        # 4. RapidAPI
        report.append({
            "name": "RapidAPI",
            "type": "Supplementary (Booking.com)",
            "enabled": bool(os.getenv("RAPIDAPI_KEY")),
            "priority": 4,
            "limit": "500 / mo",
            "refresh": "Monthly"
        })
        
        return report
