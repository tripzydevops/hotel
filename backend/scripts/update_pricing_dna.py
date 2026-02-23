import asyncio
import os
import sys
import argparse
from typing import List, Dict, Any
from datetime import datetime, timedelta
import collections
import statistics

# EXPLANATION: Path Injection Safeguard
# Ensures the 'backend' package is discoverable regardless of how the script is invoked.
# This also helps IDE linters resolve absolute imports correctly.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv # type: ignore
from supabase import create_client # type: ignore

import google.generativeai as genai # type: ignore
from backend.utils.embeddings import get_embedding # type: ignore

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
    
    # 3. Generate Strategy Description (AGENTIC UPGRADE)
    # We use Gemini Flash to analyze the price behavior instead of hardcoded rules.
    history_str = "\n".join([f"Date: {h['date']}, Price: {h['avg_price']}" for h in history])
    
    prompt = f"""
    Analyze the following 60-day price history for {hotel_name} and write a concise 'Pricing DNA' strategy profile (approx 40-60 words).
    
    FOCUS ON:
    - Yield Management: Do they keep prices flat or are they volatile?
    - Market Positioning: Are they premium anchoring or budget undercutting?
    - Weekly Patterns: Do they have consistent weekend surges or weekday premiums?
    - Strategic Intent: Describe their 'personality' (e.g., 'Aggressive Opportunist', 'Premium Stabilizer', 'Budget Follower').
    
    PRICE HISTORY:
    {history_str}
    
    Format the output as a single paragraph. No bullet points.
    """.strip()

    print(f"  -> Consulting Gemini for strategy reasoning...")
    strategy_text = "Strategy analysis failed"
    try:
        model = genai.GenerativeModel("models/gemini-flash-latest")
        response = await model.generate_content_async(prompt)
        
        if response.text:
            strategy_text = response.text.strip()
    except Exception as e:
        print(f"  -> Gemini Error: {e}")
        # Fallback to a legacy-style summary if Gemini fails
        strategy_text = f"Pricing Strategy for {hotel_name}: {volatility:.1f}% volatility, {weekend_multiplier:.2f}x weekend multiplier."
    
    print(f"  -> Strategic DNA Profile:\n{strategy_text}")
    
    # 4. Generate Embedding and Save Result
    embedding = await get_embedding(strategy_text)
    
    if embedding:
        supabase.table("hotels").update({
            "pricing_dna": embedding,
            "pricing_dna_text": strategy_text
        }).eq("id", hotel_id).execute()
        print("  -> DNA and Strategy Text Saved.")
    else:
        print("  -> Embedding Failed. Strategy text not saved.")

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
