"""
Text Normalization Utility
Provides strict normalization for search strings, hotel names, and locations.
Specifically handles Turkish character variations to prevent data fragmentation.
"""

def normalize_search_string(text: str) -> str:
    """
    Normalizes a string for consistent database comparison and search.
    - Converts to lowercase.
    - Replaces Turkish characters with their Latin counterparts.
    - Handles the capital 'İ' edge case.
    - Strips leading/trailing whitespace.
    """
    if not text:
        return ""
    
    # Pre-handle capital İ which can sometimes lower() to i plus a combining dot depending on environment
    text = text.replace("İ", "i").replace("I", "ı")
    
    text = text.lower()
    
    # Turkish character mapping
    replacements = {
        "ı": "i",
        "ş": "s",
        "ğ": "g",
        "ç": "c",
        "ö": "o",
        "ü": "u",
        "â": "a",
        "î": "i",
        "û": "u"
    }
    
    for char, target in replacements.items():
        text = text.replace(char, target)
        
    return text.strip()
