import os
from typing import List, Dict, Any
from firecrawl import FirecrawlApp
from supabase import Client
from backend.utils.logger import get_logger
from backend.services.analysis_service import get_genai_client

logger = get_logger(__name__)

class TGAScraper:
    """
    Scrapes Turkish Tourism Promotion and Development Agency (TGA) announcements.
    Uses Firecrawl for clean content extraction and Gemini 3 for semantic structuring.
    Target: https://tga.gov.tr/en/activities/announcements/
    """

    URL = "https://tga.gov.tr/en/activities/announcements/"

    def __init__(self, db: Client):
        self.db = db
        self.firecrawl = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))

    async def scrape_to_supabase(self):
        """
        [Stealth Mode] Main orchestration for TGA scraping.
        """
        logger.info("[TGAScraper] Starting semantic scrape via Firecrawl...")
        try:
            # 1. Scrape content with Firecrawl (supports JS rendering and clean markdown)
            # We target the specific listing page
            scrape_result = self.firecrawl.scrape_url(self.URL, params={'formats': ['markdown']})
            
            if not scrape_result or 'markdown' not in scrape_result:
                return {"status": "error", "message": "Failed to extract content from TGA."}

            content = scrape_result['markdown']
            logger.info(f"[TGAScraper] Extracted {len(content)} characters of content.")

            # 2. Extract structured JSON using Gemini 3
            events = await self._extract_events_with_ai(content)
            
            # 3. Store in Supabase
            processed_count = 0
            for event in events:
                try:
                    # Enrich with compression score (AI suggested or default)
                    if "compression_score" not in event:
                        event["compression_score"] = 3 # Default for TGA announcements
                    
                    event["type"] = "announcement"
                    event["metadata"] = event.get("metadata", {})
                    event["metadata"]["source"] = "TGA"
                    
                    self.db.table("market_events").upsert(
                        event,
                        on_conflict="name, start_date"
                    ).execute()
                    processed_count += 1
                except Exception as e:
                    logger.warning(f"[TGAScraper] Upsert failed for {event.get('name')}: {e}")

            return {"status": "success", "processed": processed_count}

        except Exception as e:
            logger.error(f"[TGAScraper] TGA Scraping failed: {e}")
            return {"status": "error", "message": str(e)}

    async def _extract_events_with_ai(self, content: str) -> List[Dict[str, Any]]:
        """
        Uses Gemini 3 to parse raw TGA content into structured market events.
        """
        client = get_genai_client()
        if not client:
            logger.error("[TGAScraper] GenAI client not available.")
            return []

        prompt = f"""
        You are an expert in Turkish Tourism Intelligence. Extract a list of tourism announcements and festivals from the raw markdown content.
        
        INSTRUCTIONS:
        1. Identify the event name, city, start date, and end date.
        2. If specific dates aren't found, use your best judgment based on the context (e.g., 'May 2026' -> '2026-05-01').
        3. Assign a 'compression_score' (1-10) based on the likely impact on hotel occupancy (e.g., a massive festival or 100+ person influencer group is higher).
        4. Focus on cities like Istanbul, Antalya, Izmir, Bodrum, or Mugla.
        
        OUTPUT FORMAT: JSON array of objects with keys:
        - name: string
        - city: string (English name, e.g., 'Istanbul')
        - start_date: string (ISO YYYY-MM-DD)
        - end_date: string (ISO YYYY-MM-DD)
        - description: string (Short summary)
        - compression_score: integer
        
        CONTENT:
        {content[:15000]} # Limit tokens
        """

        # KAİZEN: Always use gemini-3-* models as per project 'gemini-api-dev' skills.
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview", contents=prompt
            )
            
            if response and response.text:
                # Basic JSON extraction from text
                import json
                raw_text = response.text
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                     raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
                return json.loads(raw_text)
        except Exception as e:
            logger.error(f"[TGAScraper] AI extraction failed: {e}")
            return []

        return []
