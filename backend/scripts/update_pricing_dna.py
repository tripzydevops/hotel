
import asyncio
import os
import sys
import argparse
from typing import List, Dict, Any
from datetime import datetime, timedelta
import collections
import statistics

from dotenv import load_dotenv
from supabase import create_client

# Ensure backend module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.utils.embeddings import get_embedding

load_dotenv()
load_dotenv(".env.local", override=True)

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Credentials missing")
    sys.exit(1)

supabase = create_client(url, key)

async def process_hotel(hotel_id: str, hotel_name: str, min_days: int = 14):
    print(f"[{hotel_name}] Analyzing pricing strategy...")
    
    # 1. Fetch Price History (Aggregated Daily)
    # limit to 60 days
    res = supabase.table("price_history_daily") \
        .select("*") \
        .eq("hotel_id", hotel_id) \
        .order("date", desc=True) \
        .limit(60) \
        .execute()
        
    history = res.data or []
    
    if len(history) < min_days:
        print(f"  -> Skipped: Insufficient data ({len(history)} days < {min_days})")
        return

    # Sort by date asc
    history.sort(key=lambda x: x["date"])
    
    # 2. Extract Features
    prices = [h["avg_price"] for h in history if h["avg_price"] > 0]
    dates = [datetime.fromisoformat(h["date"]).date() for h in history]
    
    if not prices:
        return

    avg_price = statistics.mean(prices)
    min_price = min(prices)
    max_price = max(prices)
    stdev = statistics.stdev(prices) if len(prices) > 1 else 0
    volatility = (stdev / avg_price) * 100 if avg_price > 0 else 0
    
    # Day of Week Analysis
    weekday_prices = []
    weekend_prices = []
    
    for p, d in zip(prices, dates):
        if d.weekday() >= 5: # Sat, Sun (or Fri, Sat depending on definition. Python: 0=Mon, 5=Sat, 6=Sun)
            weekend_prices.append(p)
        else:
            weekday_prices.append(p)
            
    avg_weekday = statistics.mean(weekday_prices) if weekday_prices else avg_price
    avg_weekend = statistics.mean(weekend_prices) if weekend_prices else avg_price
    
    weekend_multiplier = (avg_weekend / avg_weekday) if avg_weekday > 0 else 1.0
    
    # 3. Generate Strategy Description
    # We construct a text prompt describing the behavior
    
    volatility_desc = "Stable"
    if volatility > 10: volatility_desc = "Moderate volatility"
    if volatility > 25: volatility_desc = "Highly volatile"
    
    weekend_desc = "Flat pricing across week"
    if weekend_multiplier > 1.1: weekend_desc = f"Weekend surge ({int((weekend_multiplier-1)*100)}% higher)"
    if weekend_multiplier < 0.9: weekend_desc = f"Weekday premium ({int((1-weekend_multiplier)*100)}% higher)"
    
    price_range_desc = f"Rates range from {min_price:.0f} to {max_price:.0f}"
    
    strategy_text = f"""
Pricing Strategy Analysis for {hotel_name}:
- Behavior: {volatility_desc} pricing pattern.
- Weekly Pattern: {weekend_desc}.
- Range: {price_range_desc} (Avg: {avg_price:.0f}).
- Data points: {len(prices)} days observed.
    """.strip()
    
    print(f"  -> Strategy Profile:\n{strategy_text}")
    
    # 4. Generate Embedding
    embedding = await get_embedding(strategy_text)
    
    if embedding:
        supabase.table("hotels").update({"pricing_dna": embedding}).eq("id", hotel_id).execute()
        print("  -> DNA Saved.")
    else:
        print("  -> Embedding Failed.")

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hotel-id", help="Specific hotel ID")
    parser.add_argument("--min-days", type=int, default=14, help="Minimum days of history required")
    args = parser.parse_args()
    
    if args.hotel_id:
        hotels = supabase.table("hotels").select("id, name").eq("id", args.hotel_id).execute().data
    else:
        hotels = supabase.table("hotels").select("id, name").execute().data

    for h in hotels:
        await process_hotel(h["id"], h["name"], min_days=args.min_days)

if __name__ == "__main__":
    asyncio.run(main())
