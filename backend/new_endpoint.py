
# ... (imports already exist in main.py)

@app.get("/api/admin/market-intelligence")
async def get_market_intelligence(
    city: str = Query(..., description="City to filter by"),
    limit: int = 100,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Get aggregated market intelligence for a specific city.
    Sources from 'hotel_directory' (or 'hotels' if directory incomplete).
    """
    try:
        # 1. Fetch hotels in city (limit for map performance)
        # Using hotel_directory for broader market view
        hotels_query = db.table("hotel_directory") \
            .select("id, name, location, latitude, longitude, created_at") \
            .ilike("location", f"%{city}%") \
            .limit(limit) \
            .execute()
        
        hotels = hotels_query.data or []
        
        if not hotels:
            # Fallback to user-added hotels if directory is empty for this query
            hotels_query = db.table("hotels") \
                .select("id, name, location, latitude, longitude") \
                .ilike("location", f"%{city}%") \
                .limit(limit) \
                .execute()
            hotels = hotels_query.data or []

        # 2. Mocking Price Data for Intelligence Demo (since we don't have directory prices yet)
        # In production, we'd join with a `directory_prices` table or similar.
        # For now, we simulate a realistic distribution based on "avg_price" if available or random
        import random
        
        enriched_hotels = []
        prices = []
        
        for h in hotels:
            # Simulate price between $50 and $250
            sim_price = random.randint(50, 250)
            prices.append(sim_price)
            enriched_hotels.append({
                **h,
                "latest_price": sim_price,
                "rating": round(random.uniform(3.5, 5.0), 1)
            })

        # 3. Calculate Summary Metrics
        if prices:
            avg_price = sum(prices) / len(prices)
            min_price = min(prices)
            max_price = max(prices)
        else:
            avg_price = 0
            min_price = 0
            max_price = 0

        # Scan Coverage (Mock: % of hotels that satisfy some condition)
        # In real world: count(hotels with recent price_logs) / total_hotels
        scan_coverage_pct = 78.5 # Placeholder based on system health

        return {
            "summary": {
                "hotel_count": len(hotels),
                "avg_price": round(avg_price, 2),
                "price_range": [min_price, max_price],
                "scan_coverage_pct": scan_coverage_pct
            },
            "hotels": enriched_hotels
        }

    except Exception as e:
        print(f"Market Intelligence Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
