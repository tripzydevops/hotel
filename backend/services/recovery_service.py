"""
Recovery Service.
Handles AI-powered dispute generation for parity violations.
"""
import os
from typing import Optional, Dict, Any
from backend.utils.logger import get_logger

logger = get_logger(__name__)

def get_genai_client():
    try:
        from google import genai
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            return genai.Client(api_key=api_key)
    except ImportError:
        logger.warning("google-genai SDK missing")
    return None

async def generate_dispute_letter(
    hotel_name: str,
    ota_name: str,
    current_price: float,
    target_price: float,
    currency: str,
    language: str = "tr"
) -> str:
    gap = round(target_price - current_price, 2)
    
    prompt = f"""
    You are a professional Revenue Manager at {hotel_name}. 
    We have detected a rate parity violation on {ota_name}.
    
    Violation Details:
    - Our Official Rate: {target_price} {currency}
    - {ota_name} Rate: {current_price} {currency}
    - Price Gap: {gap} {currency}
    
    Task:
    Write a professional, firm, and concise dispute letter to the {ota_name} Market Manager.
    The tone should be business-professional. 
    Demand an immediate adjustment to match our official rate to maintain parity agreements.
    Mention that this discrepancy is causing significant revenue loss.
    
    Language: {language} (respond in this language). 
    Do not include placeholders like [Market Manager Name], just use a generic professional greeting if name is unknown.
    """

    client = get_genai_client()
    if client:
        try:
            response = client.models.generate_content(
                model="gemini-3.0-flash-preview",
                contents=prompt,
            )
            return response.text
        except Exception as e:
            logger.error(f"GenAI SDK failed: {e}")
            # Fall back to HTTP if genai fails
            pass

    # Fallback to HTTP API
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return "AI Service Unavailable. Please configure the GOOGLE_API_KEY."
    
    import httpx
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash-preview:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(url, json=payload, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.error(f"Dispute generation via HTTP failed: {e}")
        return "Failed to generate dispute letter. Please try again later."

