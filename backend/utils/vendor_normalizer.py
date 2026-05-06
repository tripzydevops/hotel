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
        "trip": "Trip.com",
        "airbnb": "Airbnb",
        "trivago": "Trivago",
        "kayak": "Kayak",
        "hotelbeds": "Hotelbeds",
        "amoma": "Amoma",
        "ostrovok": "Ostrovok",
        "ctrip": "Ctrip",
        "rakuten": "Rakuten",
        "google hotels": "Google Hotels",
        
        # Turkish OTAs
        "tatilbudur": "Tatilbudur",
        "tatilbudur.com": "Tatilbudur",
        "otelz": "Otelz",
        "otelz.com": "Otelz",
        "jolly": "Jolly Tur",
        "jollytur": "Jolly Tur",
        "jolly tur": "Jolly Tur",
        "etstur": "ETS Tur",
        "ets tur": "ETS Tur",
        "ets": "ETS Tur",
        "setur": "Setur",
        "setur.com.tr": "Setur",
        "tatil": "Tatil.com",
        "tatil.com": "Tatil.com",
        "neredekal": "Neredekal",
        "neredekal.com": "Neredekal",
        "odamax": "Odamax",
        "odamax.com": "Odamax",
        "gezinomi": "Gezinomi",
        "eccetur": "EcceTur",
        "tatilsepeti": "Tatil Sepeti",
        "tatil sepeti": "Tatil Sepeti",
        
        # International OTAs
        "priceline": "Priceline",
        "priceline.com": "Priceline",
        "orbitz": "Orbitz",
        "orbitz.com": "Orbitz",
        "travelocity": "Travelocity",
        "snaptravel": "SnapTravel",
        "snap travel": "SnapTravel",
        "super.com": "Super.com",
        "super": "Super.com",
        "hoteltonight": "HotelTonight",
        "hotel tonight": "HotelTonight",
        "lastminute": "Lastminute.com",
        "lastminute.com": "Lastminute.com",
        "zenhotels": "ZenHotels",
        "zenhotels.com": "ZenHotels",
        "hotwire": "Hotwire",
        "hotwire.com": "Hotwire",
        "venere": "Venere",
        "venere.com": "Venere",
        "otel.com": "Otel.com",
        "otel": "Otel.com",
        "destinia": "Destinia",
        "destinia.com": "Destinia",
        "findhotel": "FindHotel",
        "findhotel.com": "FindHotel",
        "nuitee": "Nuitee",
        "prestigia": "Prestigia",
        "prestigia.com": "Prestigia",
        "ebookers": "Ebookers",
        "ebookers.com": "Ebookers",
        "opodo": "Opodo",
        "opodo.com": "Opodo",
        "edreams": "eDreams",
        "edreams.com": "eDreams",
        "gotogate": "Gotogate",
        "gotogate.com": "Gotogate",
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
        r"\.com\.tr\b",
        r"\.com\b",  # Strip .com suffix for easier matching
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

        # 2. Check canonical map on original cleaned lower-case string
        lookup = clean_name.lower()
        if lookup in cls.CANONICAL_MAP:
            return cls.CANONICAL_MAP[lookup]

        # 3. Apply clutter strip patterns first (everything except the last two: .com.tr and .com)
        stripped_name = clean_name
        for pattern in cls.STRIP_PATTERNS[:-2]:
            stripped_name = re.sub(pattern, "", stripped_name, flags=re.IGNORECASE).strip()

        # Check canonical map on partially stripped lower-case string (e.g., "Trip.com (Mobile App)" -> "Trip.com")
        stripped_lookup = stripped_name.lower()
        if stripped_lookup in cls.CANONICAL_MAP:
            return cls.CANONICAL_MAP[stripped_lookup]

        # 4. Now apply domain suffix strip patterns (.com.tr and .com)
        for pattern in cls.STRIP_PATTERNS[-2:]:
            stripped_name = re.sub(pattern, "", stripped_name, flags=re.IGNORECASE).strip()

        # Remove excess whitespace
        stripped_name = re.sub(r"\s+", " ", stripped_name).strip()

        # 5. Check canonical map again on fully stripped lower-case string
        fully_stripped_lookup = stripped_name.lower()
        if fully_stripped_lookup in cls.CANONICAL_MAP:
            return cls.CANONICAL_MAP[fully_stripped_lookup]

        # 6. Fallback: Return stripped name if it's not empty, otherwise original
        return stripped_name if stripped_name else clean_name

# Global helper function for ease of use
def normalize_vendor_name(name: str) -> str:
    return VendorNormalizer.normalize(name)
