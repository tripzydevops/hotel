import json
import os
import time
import urllib.request
from datetime import date
from typing import Optional

# EXPLANATION: uuid4 is used to generate the required primary key for query_logs
# as the database table lacks an auto-generator.
from uuid import UUID, uuid4

from supabase import Client  # type: ignore

# Exchange rates to USD (stable hardcoded fallbacks, updated periodically)
EXCHANGE_RATES_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,  # 1 EUR = 1.08 USD
    "GBP": 1.26,  # 1 GBP = 1.26 USD
    "TRY": 0.029,  # 1 TRY = 0.029 USD
    "TL": 0.029,   # Alias for TRY
}

# Determine the best path for the persistent exchange rates cache
# We try to use a persistent workspace folder first, otherwise fallback to /tmp
_CACHE_DIR = os.path.dirname(os.path.abspath(__file__))
_CACHE_FILE = os.path.join(_CACHE_DIR, "exchange_rates_cache.json")
_TMP_CACHE_FILE = "/tmp/exchange_rates_cache.json"


def _load_cache_from_disk() -> tuple[dict, float]:
    """Load exchange rates and modification time from persistent cache file, falling back to static baseline."""
    for path in [_CACHE_FILE, _TMP_CACHE_FILE]:
        try:
            if os.path.exists(path):
                mtime = os.path.getmtime(path)
                # Ensure mtime is sane (not in the future)
                if mtime > time.time():
                    mtime = time.time()
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "USD" in data:
                        rates = {k.upper(): float(v) for k, v in data.items() if v}
                        return rates, mtime
        except Exception:
            pass
    return dict(EXCHANGE_RATES_TO_USD), 0.0


def _save_cache_to_disk(rates: dict) -> None:
    """Save exchange rates to persistent cache file across local or /tmp paths."""
    for path in [_CACHE_FILE, _TMP_CACHE_FILE]:
        try:
            # Ensure directories exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(rates, f, indent=2)
            return  # Successfully saved, no need to write to fallback paths
        except Exception:
            # Continue to next path if we hit permission/readonly issues
            pass


# Dynamic in-memory caching for exchange rates (initialized from persistent disk cache if available)
_EXCHANGE_RATE_CACHE, _LAST_FETCH_TIME = _load_cache_from_disk()
_CACHE_TTL_SECONDS = 14400  # 4 hours cache lifetime


def _update_exchange_rates_live() -> None:
    """Fetch live exchange rates from public API and update cache, falling back gracefully on failure."""
    global _LAST_FETCH_TIME, _EXCHANGE_RATE_CACHE
    now = time.time()

    # Only fetch if cache has expired
    if now - _LAST_FETCH_TIME < _CACHE_TTL_SECONDS:
        return

    try:
        req = urllib.request.Request(
            "https://open.er-api.com/v6/latest/USD",
            headers={"User-Agent": "HotelPlus-Exchange-Rate-Fetcher/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode("utf-8"))

            if data.get("result") == "success" and "rates" in data:
                rates = data["rates"]
                new_cache = {"USD": 1.0}

                # API returns rates as units per 1 USD (e.g. TRY = 45.2).
                # We need 1 unit in USD (e.g. 1 TRY = 1 / 45.2 = 0.0221 USD).
                for currency, rate_val in rates.items():
                    if rate_val and rate_val > 0:
                        new_cache[currency.upper()] = 1.0 / rate_val

                # Ensure Turkish Lira alias is correctly updated
                if "TRY" in new_cache:
                    new_cache["TL"] = new_cache["TRY"]

                _EXCHANGE_RATE_CACHE = new_cache
                _LAST_FETCH_TIME = now
                _save_cache_to_disk(new_cache)
    except Exception as e:
        # Gracefully handle network/API failures by printing a warning and continuing with cached rates
        print(f"[CURRENCY API WARNING] Failed to fetch live exchange rates: {e}. Using cached/static fallbacks.")
        # Delay the next retry by 5 minutes to prevent spamming
        _LAST_FETCH_TIME = now - _CACHE_TTL_SECONDS + 300


def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert amount from one currency to another via USD using dynamic cached rates."""
    # Ensure currencies are strings and uppercase to prevent NoneType crashes
    from_currency = (from_currency or "TRY").upper()
    to_currency = (to_currency or "TRY").upper()
    if from_currency == to_currency:
        return amount

    # Update exchange rates if expired
    _update_exchange_rates_live()

    # Convert to USD first (using cache with static fallback)
    usd_rate = _EXCHANGE_RATE_CACHE.get(
        from_currency, EXCHANGE_RATES_TO_USD.get(from_currency, 1.0)
    )
    usd_amount = amount * usd_rate

    # Convert from USD to target (using cache with static fallback)
    usd_to_target = _EXCHANGE_RATE_CACHE.get(
        to_currency, EXCHANGE_RATES_TO_USD.get(to_currency, 1.0)
    )

    # Manual rounding to 2 decimals to satisfy strict linting requirements
    return round(usd_amount / usd_to_target * 100) / 100.0


async def log_query(
    db: Client,
    user_id: Optional[UUID],
    hotel_name: str,
    location: Optional[str],
    action_type: str,
    status: str = "success",
    price: Optional[float] = None,
    currency: Optional[str] = None,
    vendor: Optional[str] = None,
    session_id: Optional[UUID] = None,
    check_in: Optional[date] = None,
    adults: Optional[int] = 2,
    api_key_suffix: Optional[str] = None,
):
    """Log a search or monitor query for future reporting/analysis."""
    try:
        log_data = {
            "id": str(
                uuid4()
            ),  # [FIX] Explicitly provide ID to satisfy NOT NULL constraint
            "user_id": str(user_id) if user_id else None,
            "hotel_name": hotel_name.title().strip(),
            "location": location.title().strip() if location else None,
            "action_type": action_type,
            "status": status,
            "price": price,
            "currency": currency,
            "vendor": vendor,
            "session_id": str(session_id) if session_id else None,
            "check_in_date": check_in.isoformat() if check_in else None,
            "adults": adults,
            "api_key_suffix": api_key_suffix,
        }

        db.table("query_logs").insert(log_data).execute()
    except Exception as e:
        print(f"Error logging query: {e}")


def normalize_room_name(name: str) -> str:
    """Standardize room names for cataloging and comparison using RoomTypeNormalizer."""
    from backend.utils.room_normalizer import RoomTypeNormalizer

    if not name:
        return "Standard Room"

    normalized = RoomTypeNormalizer.normalize(name)
    return normalized["canonical_name"]
