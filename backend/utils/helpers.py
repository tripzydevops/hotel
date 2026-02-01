
from datetime import date
from typing import Optional
from uuid import UUID
from supabase import Client

# Exchange rates to USD (approximate, update periodically or use API)
EXCHANGE_RATES_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,      # 1 EUR = 1.08 USD
    "GBP": 1.26,      # 1 GBP = 1.26 USD
    "TRY": 0.029,     # 1 TRY = 0.029 USD
}

def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert amount from one currency to another via USD."""
    if from_currency == to_currency:
        return amount
    # Convert to USD first
    usd_rate = EXCHANGE_RATES_TO_USD.get(from_currency, 1.0)
    usd_amount = amount * usd_rate
    # Convert from USD to target
    target_rate = EXCHANGE_RATES_TO_USD.get(to_currency, 1.0)
    return round(usd_amount / target_rate, 2)

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
    adults: Optional[int] = 2
):
    """Log a search or monitor query for future reporting/analysis."""
    try:
        log_data = {
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
            "adults": adults
        }
        
        db.table("query_logs").insert(log_data).execute()
    except Exception as e:
        print(f"Error logging query: {e}")
