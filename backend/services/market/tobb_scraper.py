import asyncio
import io
import os
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from supabase import Client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class TOBBScraper:
    """
    Automates the extraction of the Turkish Fair Calendar from TOBB.
    Target: https://fuarlar.tobb.org.tr/FuarTakvimi
    """

    URL = "https://fuarlar.tobb.org.tr/FuarTakvimi"
    RELEVANT_CITIES = ["İSTANBUL", "ANTALYA", "İZMİR", "MUĞLA", "ANKARA"]

    def __init__(self, db: Client):
        self.db = db

    async def scrape_to_supabase(self):
        """
        [Stealth Mode] Main orchestration for TOBB scraping.
        """
        logger.info("[TOBBScraper] Starting scrape via Firecrawl CLI...")
        try:
            import subprocess
            
            # Since the TOBB table is heavily JS-rendered, we use scrape with a wait-for
            # Alternatively, we could use 'agent' but 'scrape' is faster if it works.
            process = subprocess.run(
                [
                    "npx", "-y", "firecrawl-cli@1.8.0", "scrape", 
                    self.URL, 
                    "--wait-for", "5000", 
                    "-f", "markdown"
                ],
                capture_output=True,
                text=True,
                check=False
            )
            
            if process.returncode != 0:
                logger.error(f"[TOBBScraper] Firecrawl CLI failed: {process.stderr}")
                return {"status": "error", "message": f"Firecrawl failed: {process.stderr}"}
                
            content = process.stdout
            
            if not content or len(content) < 500:
                logger.warning(f"[TOBBScraper] Content too short: {len(content)} chars.")
                return {"status": "error", "message": "Failed to extract meaningful content from TOBB."}

            logger.info(f"[TOBBScraper] Extracted {len(content)} characters. Using AI to parse markdown table...")

            # 2. Extract structured JSON using Gemini 3
            # We reuse the logic from TGA but with a TOBB-specific focus
            events = await self._extract_events_with_ai(content)
            
            # 3. Store in Supabase
            processed_count = 0
            for event in events:
                try:
                    # Enrich with compression score (AI suggested or default)
                    if "compression_score" not in event:
                        event["compression_score"] = 5 # Default for Fairs
                    
                    event["type"] = "fair"
                    event["metadata"] = event.get("metadata", {})
                    event["metadata"]["source"] = "TOBB"
                    
                    # Ensure city normalization (Safety check)
                    raw_city = event.get("city", "Unknown")
                    event["city"] = raw_city.replace('İ', 'I').replace('ı', 'i').capitalize()

                    self.db.table("market_events").upsert(
                        event,
                        on_conflict="name, start_date"
                    ).execute()
                    processed_count += 1
                except Exception as e:
                    logger.warning(f"[TOBBScraper] Upsert failed for {event.get('name')}: {e}")

            return {"status": "success", "processed": processed_count}

        except Exception as e:
            logger.error(f"[TOBBScraper] TOBB Scraping failed: {e}")
            return {"status": "error", "message": str(e)}

    async def _extract_events_with_ai(self, content: str) -> List[Dict[str, Any]]:
        """
        Uses Gemini 3 to parse raw TOBB markdown/table content into structured market events.
        """
        from backend.services.analysis_service import get_genai_client
        client = get_genai_client()
        if not client:
            logger.error("[TOBBScraper] GenAI client not available.")
            return []

        instructions = [
            "You are an expert in Turkish Trade Intelligence. Extract a list of upcoming trade fairs from the provided markdown content (which contains a rendered table).",
            "",
            "INSTRUCTIONS:",
            "1. Identify: Fuar Adı (Event Name), Şehir (City), Başlangıç Tarihi (Start), Bitiş Tarihi (End).",
            "2. Date Normalization: Convert DD.MM.YYYY to ISO YYYY-MM-DD.",
            "3. Focus on major cities: Istanbul, Antalya, Izmir, Bodrum, Mugla, Ankara.",
            "4. Assign a 'compression_score' (1-10) based on the likely impact on hotel occupancy (large international fairs = 8-10, local ones = 4-6).",
            "",
            "OUTPUT FORMAT: JSON array of objects with keys:",
            "- name: string",
            "- city: string (MUST BE English Title Case, e.g., 'Istanbul', 'Antalya'. Do NOT use all caps or Turkish characters like 'İ')",
            "- start_date: string (ISO YYYY-MM-DD)",
            "- end_date: string (ISO YYYY-MM-DD)",
            "- description: string (Subject of the fair)",
            "- compression_score: integer",
            "",
            "CONTENT:",
            content[:15000] 
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
            logger.error(f"[TOBBScraper] AI extraction failed: {e}")
            return []

        return []
