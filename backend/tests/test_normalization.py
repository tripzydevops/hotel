import sys
import os

# Add root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.services.serpapi_client import serpapi_client

def test_normalization():
    test_cases = [
        ("hilton", "Hilton"),
        ("HILTON", "Hilton"),
        ("hilton paris", "Hilton Paris"),
        ("  hilton   london  ", "Hilton London"),
        ("MARRIOTT HOTELS", "Marriott Hotels"),
        ("le grand hotel", "Le Grand Hotel"),
    ]
    
    print("Testing string normalization in SerpApiClient...")
    passed = 0
    for input_str, expected in test_cases:
        result = serpapi_client._normalize_string(input_str)
        if result == expected:
            print(f"PASS: '{input_str}' -> '{result}'")
            passed += 1
        else:
            print(f"FAIL: '{input_str}' -> '{result}' (Expected: '{expected}')")
            
    print(f"\nPassed {passed}/{len(test_cases)} cases.")
    return passed == len(test_cases)

if __name__ == "__main__":
    success = test_normalization()
    sys.exit(0 if success else 1)
