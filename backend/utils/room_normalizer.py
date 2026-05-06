import re
import time as _time
from typing import Dict, Optional, Set, Any

from backend.services.config_service import ConfigService

# ── Config Cache ──
# Prevents redundant DB queries during batch normalization.
# TTL: 300 seconds (5 minutes).
_config_cache: Optional[Dict[str, Any]] = None
_config_cache_ts: float = 0
_CONFIG_TTL: float = 300.0


class RoomTypeNormalizer:
    """
    Normalizes diverse room type strings into canonical codes and names.
    examples:
      "Deluxe King Room with Sea View" -> code="KNG-DLX-SV", name="King Deluxe Sea View"
      "Std. Dbl" -> code="DBL-STD", name="Double Standard"
    """

    # 1. Token Mappings (Input -> Canonical Token)
    # Order matters? Not heavily for the map, but we'll categorize them below.
    TOKEN_MAP = {
        # Beds
        "king": "KNG",
        "kng": "KNG",
        "kingsize": "KNG",
        "queen": "QN",
        "qn": "QN",
        "double": "DBL",
        "dbl": "DBL",
        "iki": "DBL",
        "cift": "DBL",  # Turkish 'iki' (two), 'cift' (double)
        "twin": "TW",
        "tw": "TW",
        "tek": "TW",  # Turkish 'tek' (single/twin context usually)
        "single": "SGL",
        "sgl": "SGL",
        # Classes / Quality
        "standard": "STD",
        "std": "STD",
        "standart": "STD",
        "deluxe": "DLX",
        "dlx": "DLX",
        "superior": "SUP",
        "sup": "SUP",
        "club": "CLB",
        "executive": "EXC",
        "exec": "EXC",
        "suite": "STE",
        "suit": "STE",
        "sut": "STE",
        "grand": "GRD",
        "premium": "PRM",
        "prm": "PRM",
        "family": "FAM",
        "aile": "FAM",
        "economy": "ECO",
        "ekonomik": "ECO",
        "promo": "ECO",
        # Views
        "sea": "SV",
        "ocean": "SV",
        "deniz": "SV",
        "city": "CV",
        "sehir": "CV",
        "garden": "GV",
        "bahce": "GV",
        "land": "LV",
        "kara": "LV",
        "pool": "PV",
        "havuz": "PV",
        "mountain": "MV",
        "dag": "MV",
        "partial": "PRT",
        "kismi": "PRT",  # Partial view modifier
        # Attributes
        "balcony": "BAL",
        "balkon": "BAL",
        "bal": "BAL",
        "terrace": "TER",
        "teras": "TER",
        "corner": "CNR",
        "kose": "CNR",
        "non-smoking": "NS",
        "nonsmoking": "NS",
        "sigara": "NS",
        # Missing high-probability tokens added in Phase 3
        "apart": "APT",
        "aprt": "APT",
        "apartman": "APT",
        "studio": "STU",
        "stdo": "STU",
        "villa": "VIL",
        "vil": "VIL",
        "bungalow": "BUN",
        "bng": "BUN",
        "honeymoon": "HMN",
        "balayi": "HMN",
        "balayı": "HMN",
        "connected": "CON",
        "conn": "CON",
        "baglantili": "CON",
        "bağlantılı": "CON",
        "penthouse": "PNT",
        "pnt": "PNT",
        "duplex": "DPX",
        "dublex": "DPX",
    }

    # 2. Canonical Token Definitions (for ordering and naming)
    CATEGORY_ORDER = {
        "KNG": 1,
        "QN": 1,
        "DBL": 1,
        "TW": 1,
        "SGL": 1,  # Beds first
        "STE": 2,
        "DLX": 2,
        "SUP": 2,
        "STD": 2,
        "CLB": 2,
        "EXC": 2,
        "GRD": 2,
        "PRM": 2,
        "FAM": 2,
        "ECO": 2,  # Class second
        "SV": 3,
        "CV": 3,
        "GV": 3,
        "LV": 3,
        "PV": 3,
        "MV": 3,  # View third
        "BAL": 4,
        "TER": 4,
        "CNR": 4,  # Attributes last
        # Missing high-probability tokens added in Phase 3
        "APT": 2,
        "STU": 2,
        "VIL": 2,
        "BUN": 2,
        "PNT": 2,
        "DPX": 2,
        "HMN": 4,
        "CON": 4,
    }

    CANONICAL_NAMES = {
        "KNG": "King",
        "QN": "Queen",
        "DBL": "Double",
        "TW": "Twin",
        "SGL": "Single",
        "STE": "Suite",
        "DLX": "Deluxe",
        "SUP": "Superior",
        "STD": "Standard",
        "CLB": "Club",
        "EXC": "Executive",
        "GRD": "Grand",
        "PRM": "Premium",
        "FAM": "Family",
        "ECO": "Economy",
        "SV": "Sea View",
        "CV": "City View",
        "GV": "Garden View",
        "LV": "Land View",
        "PV": "Pool View",
        "MV": "Mountain View",
        "BAL": "Balcony",
        "TER": "Terrace",
        "CNR": "Corner",
        "PRT": "Partial",
        "NS": "Non-Smoking",
        # Missing high-probability tokens added in Phase 3
        "APT": "Apart",
        "STU": "Studio",
        "VIL": "Villa",
        "BUN": "Bungalow",
        "HMN": "Honeymoon",
        "CON": "Connected",
        "PNT": "Penthouse",
        "DPX": "Duplex",
    }

    # 3. Common OTA/Vendor names to filter out of room type catalogs
    VENDOR_NAMES = {
        "booking.com", "expedia", "agoda", "hotels.com", "airbnb", "tripadvisor",
        "google", "tatilbudur.com", "otelz.com", "jolly tur", "etstur", "tatil.com",
        "trivago", "kayak", "priceline", "orbitz", "travelocity", "hotwire",
        "trip.com", "ctrip", "rakuten", "amoma", "venere", "otel.com", "zenhotels",
        "destinia", "findhotel", "snap travel", "super.com", "nuitee", "prestigia",
        "hoteltonight", "lastminute.com", "ebookers", "opodo", "edreams", "gotogate",
        "tatilbudur", "otelz", "etstur", "jollytur", "jolly", "setur", "neredekal", "odamax",
        "gezinomi", "eccetur", "tatilsepeti", "neredekal.com", "odamax.com", "setur.com.tr"
    }

    @classmethod
    def _get_config(cls):
        """
        Returns the effective configuration with 5-minute caching.
        Strategy: Start with STATIC hardcoded maps (safe fallback),
        then OVERRIDE with any values found in the Database.
        Cache prevents redundant DB queries during batch normalization.
        """
        global _config_cache, _config_cache_ts

        now = _time.monotonic()
        if _config_cache is not None and (now - _config_cache_ts) < _CONFIG_TTL:
            return _config_cache

        # 1. Start with Static Defaults
        effective_tokens = cls.TOKEN_MAP.copy()
        effective_names = cls.CANONICAL_NAMES.copy()
        effective_order = cls.CATEGORY_ORDER.copy()

        # Overlay Database Config (if available)
        try:
            db_config = ConfigService.get_mappings()
            if db_config.get("token_map"):
                effective_tokens.update(db_config["token_map"])
            if db_config.get("canonical_names"):
                effective_names.update(db_config["canonical_names"])
            if db_config.get("category_order"):
                effective_order.update(db_config["category_order"])
        except Exception:
            pass

        result = {
            "token_map": effective_tokens,
            "canonical_names": effective_names,
            "category_order": effective_order,
        }

        _config_cache = result
        _config_cache_ts = now
        return result

    @classmethod
    def normalize(cls, raw_string: str) -> Dict[str, Any]:
        """
        Parses a raw room string and returns a dictionary with canonical details.
        Includes vendor detection and stripping.
        """
        if not raw_string:
            return {
                "original": "",
                "canonical_code": "UNK",
                "canonical_name": "Unknown Room",
                "tokens": [],
                "is_vendor": False
            }

        # Load Configuration (Hybrid)
        config = cls._get_config()
        token_map = config["token_map"]
        canonical_names = config["canonical_names"]
        category_order = config["category_order"]

        # 1. Vendor Detection & Stripping
        clean_text = raw_string.lower().strip()
        found_vendor = False
        
        # Sort vendors by length descending to match longer patterns first (e.g. 'booking.com' before 'booking')
        sorted_vendors = sorted(list(cls.VENDOR_NAMES), key=len, reverse=True)
        
        for vendor in sorted_vendors:
            if vendor in clean_text:
                found_vendor = True
                clean_text = clean_text.replace(vendor, "")

        # 2. Clean and Tokenize
        # Remove punctuation, parentheses, brackets, etc.
        clean_text = re.sub(r"[^\w\s]", " ", clean_text)
        words = clean_text.split()

        # 3. Map words to tokens
        found_tokens: Set[str] = set()
        for word in words:
            if word in token_map:
                found_tokens.add(token_map[word])

        # If it's empty or has no valid room indicators, it was likely just a vendor name/title
        is_vendor = not words or (
            found_vendor 
            and not found_tokens 
            and not any(w in {"room", "oda", "odası"} for w in words)
        )

        sorted_tokens = sorted(
            list(found_tokens), key=lambda t: category_order.get(t, 99)
        )

        if not sorted_tokens:
            return {
                "original": raw_string,
                "canonical_code": "ROH",
                "canonical_name": raw_string.strip(),
                "tokens": [],
                "is_vendor": is_vendor
            }

        canonical_code = "-".join(sorted_tokens)

        name_parts = []
        for t in sorted_tokens:
            name_parts.append(canonical_names.get(t, t))

        canonical_name = " ".join(name_parts)

        return {
            "original": raw_string,
            "canonical_code": canonical_code,
            "canonical_name": canonical_name,
            "tokens": sorted_tokens,
            "is_vendor": is_vendor
        }
