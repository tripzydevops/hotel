import re
from typing import Dict

# EXPLANATION: Vendor Normalizer standardizes OTA and Vendor names collected from 
# multiple scrapers (SerpApi, DataForSEO, etc.). Scrapers often append platform
# specific suffixes like "(Direct)" or "(Mobile)" which clutter the UI and 
# break grouping logic.

class VendorNormalizer:
    # 1. Canonical Mappings for known OTAs
    CANONICAL_MAP: Dict[str, str] = {
        "booking": "Booking.com",
        "booking.com": "Booking.com",
        "expedia": "Expedia",
        "expedia.com": "Expedia",
        "expedia group": "Expedia",
        "hotels": "Hotels.com",
        "hotels.com": "Hotels.com",
        "agoda": "Agoda",
        "agoda.com": "Agoda",
        "tripadvisor": "TripAdvisor",
        "trip.com": "Trip.com",
        "airbnb": "Airbnb",
        "trivago": "Trivago",
        "kayak": "Kayak",
        "hotelbeds": "Hotelbeds",
        "amoma": "Amoma",
        "ostrovok": "Ostrovok",
        "ctrip": "Ctrip",
        "rakuten": "Rakuten",
        "google hotels": "Google Hotels",
    }

    # 2. Suffixes and patterns to strip
    STRIP_PATTERNS = [
        r"\(.*?\)",  # Anything in parentheses: (Direct), (Mobile), (Mobile App)
        r"\bMobile\b",
        r"\bApp\b",
        r"\bDirect\b",
        r"\bOfficial\b",
        r"\bSite\b",
        r"\bWebsite\b",
        r"\.com\b",  # Also strip .com suffix for easier matching
    ]

    @classmethod
    def normalize(cls, name: str) -> str:
        """
        Normalizes a vendor name by removing clutter and mapping to canonical forms.
        """
        if not name:
            return "Direct"
        
        # 1. Preliminary clean
        clean_name = name.strip()

        # 2. Apply strip patterns
        for pattern in cls.STRIP_PATTERNS:
            clean_name = re.sub(pattern, "", clean_name, flags=re.IGNORECASE).strip()

        # 3. Remove excess whitespace
        clean_name = re.sub(r"\s+", " ", clean_name)

        # 4. Check canonical map
        lookup = clean_name.lower()
        if lookup in cls.CANONICAL_MAP:
            return cls.CANONICAL_MAP[lookup]

        # 5. Fallback: Return title case if it's not empty, otherwise original
        return clean_name if clean_name else name.strip()

# Global helper function for ease of use
def normalize_vendor_name(name: str) -> str:
    return VendorNormalizer.normalize(name)
