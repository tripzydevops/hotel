import os
import asyncio
from typing import List, Dict, Any
from supabase import Client
from backend.utils.logger import get_logger
from backend.services.analysis_service import get_genai_client

logger = get_logger(__name__)

class TGAScraper:
    """
    Scrapes Turkish Tourism Promotion and Development Agency (TGA) announcements.
    Uses Playwright for reliable JS rendering and Gemini 3 for semantic structuring.
    Target: https://tga.gov.tr/en/activities/announcements/
    """

    URL = "https://tga.gov.tr/en/activities/announcements/"

    def __init__(self, db: Client):
        self.db = db

    async def scrape_to_supabase(self):
        """
        [Stealth Mode] Main orchestration for TGA scraping.
        """
        logger.info("[TGAScraper] Starting semantic scrape via Firecrawl CLI...")
        try:
            # Use firecrawl CLI to scrape the page content as markdown
            import subprocess
            
            # npx -y firecrawl-cli@1.8.0 scrape <url> --only-main-content -f markdown
            process = subprocess.run(
                ["npx", "-y", "firecrawl-cli@1.8.0", "scrape", self.URL, "--only-main-content", "-f", "markdown"],
                capture_output=True,
                text=True,
                check=False
            )
            
            if process.returncode != 0:
                logger.error(f"[TGAScraper] Firecrawl CLI failed: {process.stderr}")
                return {"status": "error", "message": f"Firecrawl failed: {process.stderr}"}
                
            content = process.stdout
            
            if not content or len(content) < 100:
                logger.warning(f"[TGAScraper] Content too short: {len(content)} chars.")
                return {"status": "error", "message": "Failed to extract meaningful content from TGA."}

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
        clean_preview = content[:500].replace('\n', ' ')
        logger.info(f"[TGAScraper] AI prompt content preview: {clean_preview}...")
        
        client = get_genai_client()
        if not client:
            logger.error("[TGAScraper] GenAI client not available.")
            return []

        # Safe prompt construction
        instructions = [
            "You are an expert in Turkish Tourism Intelligence. Extract a list of tourism announcements, festivals, and key activities from the raw text content.",
            "",
            "INSTRUCTIONS:",
            "1. Identify the event name, city, start date, and end date.",
            "2. Date Normalization: If a year isn't specified, assume 2026. If only a month is mentioned (e.g., May 2026), use the 1st of that month.",
            "3. Assign a 'compression_score' (1-10) based on the likely impact on hotel occupancy.",
            "4. Focus on major tourism hubs like Istanbul, Antalya, Izmir, Bodrum, or Mugla.",
            "",
            "OUTPUT FORMAT: JSON array of objects with keys:",
            "- name: string",
            "- city: string (MUST BE English Title Case, e.g., 'Istanbul', 'Antalya', 'Izmir'. Do NOT use all caps or Turkish characters like 'İ')",
            "- start_date: string (ISO YYYY-MM-DD)",
            "- end_date: string (ISO YYYY-MM-DD)",
            "- description: string (Short summary)",
            "- compression_score: integer",
            "",
            "CONTENT:",
            content[:15000].replace('"""', ' ') # Extra safety
        ]
        
        prompt = "\n".join(instructions)

        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview", contents=prompt
            )
            
            if response and response.text:
                import json
                raw_text = response.text
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                     raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
                data = json.loads(raw_text)
                return data if isinstance(data, list) else [data]
        except Exception as e:
            logger.error(f"[TGAScraper] AI extraction failed: {e}")
            return []

        return []
