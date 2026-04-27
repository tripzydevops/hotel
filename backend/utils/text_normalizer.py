import re

def normalize_search_string(text: str) -> str:
    """
    Strict normalization for Turkish hotel names and locations.
    Prevents duplicates by handling casing, Turkish characters, and formatting.
    """
    if not text:
        return ""
    
    # 1. Handle Turkish 'İ' correctly (specific to Python lowercase quirks)
    # Convert 'İ' to 'i' and 'I' to 'ı' manually to ensure consistent mapping
    text = text.replace('İ', 'i').replace('I', 'ı')
    text = text.lower()
    
    # 2. Map special Turkish characters to their base Latin versions
    # This ensures "Balıkesir" and "Balikesir" match.
    chars_map = {
        'ş': 's', 
        'ğ': 'g', 
        'ç': 'c', 
        'ö': 'o', 
        'ü': 'u', 
        'ı': 'i'
    }
    for tr_char, lat_char in chars_map.items():
        text = text.replace(tr_char, lat_char)
    
    # 3. Clean punctuation and collapse whitespace
    text = re.sub(r'[^\w\s]', ' ', text)
    text = " ".join(text.split())
    
    return text.strip()
