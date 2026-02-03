import asyncio
import os
from dotenv import load_dotenv

# Load envs
load_dotenv()
load_dotenv(".env.local", override=True)

from backend.services.provider_factory import ProviderFactory

async def test_providers():
    print("Testing Provider Factory Configuration...")
    
    # 1. Check if Decodo Key Exists
    decodo_key = os.getenv("DECODO_API_KEY")
    print(f"Decodo Key Present: {bool(decodo_key)}")
    
    if not decodo_key:
        print("SKIP: Cannot test Decodo (No Key)")
    else:
        # 2. Test Factory Selection
        provider = ProviderFactory.get_provider(prefer="auto")
        print(f"Auto-Selected Provider: {provider.get_provider_name()}")
        
        if provider.get_provider_name() == "Decodo":
            print("SUCCESS: Factory correctly prioritized Decodo.")
        else:
            print("FAILURE: Factory did not prioritize Decodo.")
            
    # 3. Test Secondary Selection
    try:
        sec_provider = ProviderFactory.get_provider(prefer="secondary")
        print(f"Secondary Provider: {sec_provider.get_provider_name()}")
    except Exception as e:
        print(f"Secondary Provider Error: {e}")

    # 4. Test Serper Selection (Explicit)
    try:
        serper_key = os.getenv("SERPER_API_KEY")
        print(f"Serper Key Present: {bool(serper_key)}")
        if serper_key:
             # Check if Serper is in the list
             providers = ProviderFactory._providers
             found_serper = any(p.get_provider_name() == "Serper.dev" for p in providers)
             print(f"Serper Provider Registered: {found_serper}")
    except Exception as e:
        print(f"Serper Error: {e}")

    # 5. Test RapidAPI Selection (Explicit)
    try:
        rapid_key = os.getenv("RAPIDAPI_KEY")
        print(f"RapidAPI Key Present: {bool(rapid_key)}")
        if rapid_key:
             providers = ProviderFactory._providers
             found_rapid = any(p.get_provider_name() == "RapidApi" for p in providers)
             print(f"RapidAPI Provider Registered: {found_rapid}")
    except Exception as e:
        print(f"RapidAPI Error: {e}")

    # 6. Test Metadata (Status Report)
    print("\n--- Metadata Check ---")
    report = ProviderFactory.get_status_report()
    for p in report:
        print(f"Provider: {p['name']} | Limit: {p.get('limit', 'N/A')} | Refresh: {p.get('refresh', 'N/A')}")

if __name__ == "__main__":
    asyncio.run(test_providers())
