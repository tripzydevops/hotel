import asyncio
import sys
from backend.services.analysis_service import perform_market_analysis

async def verify_fix():
    print("Verifying Market Analysis Fix...")
    
    # Mock Data
    user_id = "test-user"
    hotels = [
        {"id": "h1", "name": "Hotel A", "rating": 4.5, "review_count": 100, "is_target_hotel": True},
        {"id": "h2", "name": "Hotel B", "rating": 4.0, "review_count": 50},
        {"id": "h3", "name": "Hotel C", "rating": 3.5, "review_count": 20},
    ]
    
    # Mock Prices
    # H1: Target (100)
    # H2: Competitor (80)
    # H3: Competitor (120)
    hotel_prices_map = {
        "h1": [{"price": 100, "currency": "USD", "room_types": [{"name": "Standard", "price": 100}]}],
        "h2": [{"price": 80, "currency": "USD", "room_types": [{"name": "Standard", "price": 80}]}],
        "h3": [{"price": 120, "currency": "USD", "room_types": [{"name": "Standard", "price": 120}]}],
    }
    
    # Run Analysis
    result = await perform_market_analysis(
        user_id=user_id,
        hotels=hotels,
        hotel_prices_map=hotel_prices_map,
        display_currency="USD",
        room_type="Standard",
        start_date=None,
        end_date=None,
        allowed_room_names_map={}
    )
    
    # Verification assertions
    expected_fields = ["market_min", "market_max", "market_average", "min_hotel", "max_hotel", "market_rank"]
    missing = [f for f in expected_fields if f not in result]
    
    if missing:
        print(f"FAILED: Missing fields in response: {missing}")
        sys.exit(1)
        
    # Check Values
    # Prices: 100, 80, 120
    # Min: 80, Max: 120, Avg: 100
    
    if result["market_min"] != 80:
        print(f"FAILED: market_min is {result['market_min']}, expected 80")
        sys.exit(1)
        
    if result["market_max"] != 120:
        print(f"FAILED: market_max is {result['market_max']}, expected 120")
        sys.exit(1)
        
    if result["market_average"] != 100:
        print(f"FAILED: market_average is {result['market_average']}, expected 100")
        sys.exit(1)
        
    if result["min_hotel"]["name"] != "Hotel B":
        print(f"FAILED: min_hotel is {result['min_hotel']['name']}, expected Hotel B")
        sys.exit(1)
            
    if result["max_hotel"]["name"] != "Hotel C":
            print(f"FAILED: max_hotel is {result['max_hotel']['name']}, expected Hotel C")
            sys.exit(1)
    
    # Market Rank check (Target is 100, which is rank 2, between 80 and 120)
    if result["market_rank"] != 2:
        print(f"FAILED: market_rank is {result['market_rank']}, expected 2")
        sys.exit(1)

    print("SUCCESS: All fields present and calculations correct!")

if __name__ == "__main__":
    asyncio.run(verify_fix())
