
from typing import Dict, Any, Optional

class MockSerpParser:
    def _clean_hotel_name(self, name: str) -> str:
        if not name: return ""
        cleaned = name.split(" - ")[0]
        cleaned = cleaned.split(" | ")[0]
        cleaned = cleaned.split(" (")[0]
        return " ".join(word.capitalize() for word in cleaned.split())

    def _parse_hotel_result(
        self, 
        data: Dict[str, Any], 
        target_hotel: str,
        default_currency: str = "USD"
    ) -> Optional[Dict[str, Any]]:
        properties = data.get("properties", [])
        if not properties:
            print("[SerpApi] No properties found")
            return None
        
        # Assume first match for repro
        best_match = properties[0]
        
        print(f"Parsing match: {best_match.get('name')}")
        
        # Extract price and currency
        price = None
        
        if "rate_per_night" in best_match:
            rate = best_match["rate_per_night"]
            if isinstance(rate, dict):
                price = rate.get("extracted_lowest", rate.get("lowest"))
            else:
                price = rate
        
        print(f"Raw Price: {price}")

        if isinstance(price, str):
            import re
            # Only keep digits, dot, comma
            clean_str = re.sub(r'[^\d.,]', '', price)
            print(f"Cleaned Str: {clean_str}")
            
            # Logic from actual code
            if "," in clean_str and "." not in clean_str:
                 clean_str = clean_str.replace(",", "")
            elif "," in clean_str and "." in clean_str:
                 clean_str = clean_str.replace(",", "")
            elif "." in clean_str:
                 pass # Standard float

            # ISSUE: Turkish Locale often uses 1.234,56 or 1,234.56 depending on SerpApi setting.
            # If gl=tr, SerpApi often returns "TRY 1.234" (dot as thousands in TR usage) 
            # OR "TRY 1,234" (US format if hl=en).
            
            print(f"Processed Str: {clean_str}")
            
            try:
                price = float(clean_str)
            except ValueError:
                print(f"[SerpApi] Failed to parse: {price}")
                price = None
        
        return {"price": price}

# Test Cases
parser = MockSerpParser()

# Case 1: TRY with thousands dot (Turkish standard)
data_tr_dot = {
    "properties": [{
        "name": "Willmont Hotel",
        "rate_per_night": {"lowest": "TRY 5.677"}
    }]
}
print("--- Test 1: TRY 5.677 ---")
print(parser._parse_hotel_result(data_tr_dot, "Willmont Hotel"))

# Case 2: TRY with thousands comma (US standard)
data_tr_comma = {
    "properties": [{
        "name": "Willmont Hotel",
        "rate_per_night": {"lowest": "TRY 5,677"}
    }]
}
print("\n--- Test 2: TRY 5,677 ---")
print(parser._parse_hotel_result(data_tr_comma, "Willmont Hotel"))

# Case 3: TRY with decimal comma (Turkish standard for cents: 5.677,50)
data_tr_decimal = {
    "properties": [{
        "name": "Willmont Hotel",
        "rate_per_night": {"lowest": "TRY 5.677,50"}
    }]
}
print("\n--- Test 3: TRY 5.677,50 (Complex) ---")
print(parser._parse_hotel_result(data_tr_decimal, "Willmont Hotel"))
