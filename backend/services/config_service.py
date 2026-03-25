from typing import Dict, Any
from threading import Lock
from datetime import datetime, timedelta
from backend.utils.db import get_supabase


class ConfigService:
    _instance = None
    _lock = Lock()

    _token_map: Dict[str, str] = {}
    _canonical_names: Dict[str, str] = {}
    _category_order: Dict[str, int] = {}
    _last_loaded: datetime = datetime.min
    _cache_ttl = timedelta(minutes=15)  # Refresh every 15 mins

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ConfigService, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_mappings(cls) -> Dict[str, Any]:
        """Returns the cached mappings, refreshing if expired."""
        if datetime.now() - cls._last_loaded > cls._cache_ttl:
            cls.refresh_config()

        return {
            "token_map": cls._token_map,
            "canonical_names": cls._canonical_names,
            "category_order": cls._category_order,
        }

    @classmethod
    def refresh_config(cls):
        """Fetches fresh config from Supabase."""
        # print("Refeshing Room Config from DB...")
        db = get_supabase()

        # 1. Fetch Tokens (Definitions)
        try:
            tokens_res = db.table("room_tokens").select("*").execute()
            tokens = tokens_res.data or []

            new_names = {}
            new_order = {}

            for t in tokens:
                code = t["canonical_code"]
                new_names[code] = t["canonical_name"]
                new_order[code] = t["priority"]

            cls._canonical_names = new_names
            cls._category_order = new_order

        except Exception as e:
            print(f"ConfigService Error fetching tokens: {e}")

        # 2. Fetch Aliases (Mappings)
        try:
            aliases_res = (
                db.table("room_aliases").select("alias, canonical_code").execute()
            )
            aliases = aliases_res.data or []

            new_map = {}
            for a in aliases:
                new_map[a["alias"]] = a["canonical_code"]

            cls._token_map = new_map
            cls._last_loaded = datetime.now()

        except Exception as e:
            print(f"ConfigService Error fetching aliases: {e}")


# Global accessor
def get_room_config():
    return ConfigService.get_mappings()
