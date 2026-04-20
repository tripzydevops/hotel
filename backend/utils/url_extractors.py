import re
from typing import Optional, Dict

def extract_from_booking_url(url: str) -> Optional[Dict[str, str]]:
    """
    Extracts the hotel slug from a Booking.com URL.
    Returns:
        dict with 'vendor' and 'hotel_id'
        e.g., {'vendor': 'Booking.com', 'hotel_id': 'the-plaza'}
    """
    match = re.search(r'/hotel/[^/]+/([^\.\?]+)', url)
    if match:
        return {"vendor": "Booking.com", "hotel_id": match.group(1)}
    return None

def extract_from_tripadvisor_url(url: str) -> Optional[Dict[str, str]]:
    """
    Extracts the location ID (g-code) and hotel ID (d-code) from a Tripadvisor URL.
    Returns:
        dict with 'vendor', 'location_id', and 'hotel_id'
        e.g., {'vendor': 'TripAdvisor', 'location_id': 'g293974', 'hotel_id': 'd295484'}
    """
    match = re.search(r'Hotel_Review-(g\d+)-(d\d+)-', url)
    if match:
        return {"vendor": "TripAdvisor", "location_id": match.group(1), "hotel_id": match.group(2)}
    return None

def extract_from_expedia_url(url: str) -> Optional[Dict[str, str]]:
    """
    Extracts the hotel ID (h-code) from an Expedia or Hotels.com URL.
    Returns:
        dict with 'vendor' and 'hotel_id'
        e.g., {'vendor': 'Expedia', 'hotel_id': 'h6003290'}
    """
    match = re.search(r'\.h(\d+)\.Hotel-Information', url, re.IGNORECASE)
    if match:
        return {"vendor": "Expedia", "hotel_id": f"h{match.group(1)}"}
    return None

def extract_hotel_data_from_url(url: str) -> Optional[Dict[str, str]]:
    """
    Determines the OTA vendor from the URL and extracts identifying hotel data.
    Supported vendors: Booking.com, TripAdvisor, Expedia/Hotels.com.
    """
    url_lower = url.lower()
    if 'booking.com' in url_lower:
        return extract_from_booking_url(url)
    elif 'tripadvisor' in url_lower:
        return extract_from_tripadvisor_url(url)
    elif 'expedia.com' in url_lower or 'hotels.com' in url_lower:
        return extract_from_expedia_url(url)
    return None
