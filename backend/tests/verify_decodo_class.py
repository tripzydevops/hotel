import asyncio
from datetime import date, timedelta
from dotenv import load_dotenv
from backend.services.providers.decodo_provider import DecodoProvider

# Load envs so standard logic works if keys are present
load_dotenv()
load_dotenv(".env.local", override=True)

async def test_provider_class():
    print("--- Testing DecodoProvider Class Integration ---")
    
    # Force the key for this test to ensure we test the exact user scenario
    api_key = "VTAwMDAzNTA0OTE6UFdfMTI0Zjg3YjBiODQ1OTg4MmNiMTI0NTIyMjY0NDZkODVm"
    provider = DecodoProvider(api_key=api_key)
    
    print(f"Provider Initialized: {provider.get_provider_name()}")
    
    check_in = date.today() + timedelta(days=30)
    check_out = check_in + timedelta(days=1)
    
    print("Calling fetch_price()...")
    result = await provider.fetch_price(
        hotel_name="Willmont Hotel",
        location="Balikesir",
        check_in=check_in,
        check_out=check_out,
        adults=2,
        currency="USD"
    )
    
    print("\n--- Result ---")
    if result:
        print("SUCCESS: Price found!")
        print(result)
    else:
        print("RESULT: None (Provider returned no data or handled error)")
        # We expect this if Decodo returns 11101, which is "Correct Behavior" for the code (failover ready)

if __name__ == "__main__":
    asyncio.run(test_provider_class())
