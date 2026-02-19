import re
from typing import List, Dict, Optional, Set

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
        "king": "KNG", "kng": "KNG", "kingsize": "KNG",
        "queen": "QN", "qn": "QN",
        "double": "DBL", "dbl": "DBL", "iki": "DBL", "cift": "DBL",  # Turkish 'iki' (two), 'cift' (double)
        "twin": "TW", "tw": "TW", "tek": "TW",  # Turkish 'tek' (single/twin context usually)
        "single": "SGL", "sgl": "SGL",
        
        # Classes / Quality
        "standard": "STD", "std": "STD", "standart": "STD",
        "deluxe": "DLX", "dlx": "DLX",
        "superior": "SUP", "sup": "SUP",
        "club": "CLB",
        "executive": "EXC", "exec": "EXC",
        "suite": "STE", "suit": "STE", "sut": "STE",
        "grand": "GRD",
        "premium": "PRM", "prm": "PRM",
        "family": "FAM", "aile": "FAM",
        "economy": "ECO", "ekonomik": "ECO", "promo": "ECO",
        
        # Views
        "sea": "SV", "ocean": "SV", "deniz": "SV",
        "city": "CV", "sehir": "CV",
        "garden": "GV", "bahce": "GV",
        "land": "LV", "kara": "LV",
        "pool": "PV", "havuz": "PV",
        "mountain": "MV", "dag": "MV",
        "partial": "PRT", "kismi": "PRT", # Partial view modifier
        
        # Attributes
        "balcony": "BAL", "balkon": "BAL", "bal": "BAL",
        "terrace": "TER", "teras": "TER",
        "corner": "CNR", "kose": "CNR",
        "non-smoking": "NS", "nonsmoking": "NS", "sigara": "NS",
    }

    # 2. Canonical Token Definitions (for ordering and naming)
    CATEGORY_ORDER = {
        "KNG": 1, "QN": 1, "DBL": 1, "TW": 1, "SGL": 1,  # Beds first
        "STE": 2, "DLX": 2, "SUP": 2, "STD": 2, "CLB": 2, "EXC": 2, "GRD": 2, "PRM": 2, "FAM": 2, "ECO": 2, # Class second
        "SV": 3, "CV": 3, "GV": 3, "LV": 3, "PV": 3, "MV": 3, # View third
        "BAL": 4, "TER": 4, "CNR": 4, # Attributes last
    }

    CANONICAL_NAMES = {
        "KNG": "King", "QN": "Queen", "DBL": "Double", "TW": "Twin", "SGL": "Single",
        "STE": "Suite", "DLX": "Deluxe", "SUP": "Superior", "STD": "Standard", "CLB": "Club", "EXC": "Executive", "GRD": "Grand", "PRM": "Premium", "FAM": "Family", "ECO": "Economy",
        "SV": "Sea View", "CV": "City View", "GV": "Garden View", "LV": "Land View", "PV": "Pool View", "MV": "Mountain View",
        "BAL": "Balcony", "TER": "Terrace", "CNR": "Corner",
        "PRT": "Partial", 
        "NS": "Non-Smoking"
    }


    # Dynamic Configuration via Database (Hybrid Fallback)
    from backend.services.config_service import ConfigService

    @classmethod
    def _get_config(cls):
        """
        Returns the effective configuration.
        Strategy: Start with STATIC hardcoded maps (safe fallback), 
        then OVERRIDE with any values found in the Database.
        """
        # 1. Start with Static Defaults
        effective_tokens = cls.TOKEN_MAP.copy()
        effective_names = cls.CANONICAL_NAMES.copy()
        effective_order = cls.CATEGORY_ORDER.copy()

        # 2. Overlay Database Config (if available)
        try:
            db_config = ConfigService.get_mappings()
            
            # Merge Aliases
            if db_config.get("token_map"):
                effective_tokens.update(db_config["token_map"])
                
            # Merge Names
            if db_config.get("canonical_names"):
                effective_names.update(db_config["canonical_names"])
                
            # Merge Order
            if db_config.get("category_order"):
                effective_order.update(db_config["category_order"])
                
        except Exception:
            # If DB fails (e.g. migration not run yet), we just use static defaults
            pass

        return {
            "token_map": effective_tokens,
            "canonical_names": effective_names,
            "category_order": effective_order
        }

    @classmethod
    def normalize(cls, raw_string: str) -> Dict[str, str]:
        """
        Parses a raw room string and returns a dictionary with canonical details.
        """
        if not raw_string:
            return {
                "original": "",
                "canonical_code": "UNK", 
                "canonical_name": "Unknown Room",
                "tokens": []
            }

        # Load Configuration (Hybrid)
        config = cls._get_config()
        token_map = config["token_map"]
        canonical_names = config["canonical_names"]
        category_order = config["category_order"]

        # 1. Clean and Tokenize
        clean_text = raw_string.lower()
        # Remove punctuation, parentheses, brackets, etc.
        clean_text = re.sub(r'[^\w\s]', ' ', clean_text)
        
        words = clean_text.split()
        
        found_tokens: Set[str] = set()
        
        # 2. Map words to tokens
        for word in words:
            if word in token_map:
                found_tokens.add(token_map[word])

        sorted_tokens = sorted(
            list(found_tokens),
            key=lambda t: category_order.get(t, 99)
        )
        
        if not sorted_tokens:
            return {
                "original": raw_string,
                "canonical_code": "ROH", 
                "canonical_name": raw_string.strip(), 
                "tokens": []
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
            "tokens": sorted_tokens
        }
