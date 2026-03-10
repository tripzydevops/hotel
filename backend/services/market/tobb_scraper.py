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
        logger.info("[TOBBScraper] Initiating headless browser...")
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Navigate to TOBB
                await page.goto(self.URL, timeout=60000)
                logger.info(f"[TOBBScraper] Page loaded: {self.URL}")

                # Wait for the "Excel'e Kaydet" button
                # The button usually has an ID or a specific text
                excel_btn_selector = "input[name*='btnExcel']" # Common ASP.NET naming
                
                # Intercept the download
                async with page.expect_download() as download_info:
                    await page.click(excel_btn_selector)
                
                download = await download_info.value
                excel_buffer = await download.path()
                logger.info(f"[TOBBScraper] Downloaded Excel to {excel_buffer}")

                # Parse with Pandas
                df = pd.read_excel(excel_buffer)
                await browser.close()

                return await self._process_dataframe(df)

        except Exception as e:
            logger.error(f"[TOBBScraper] Scraping failed: {e}")
            return {"status": "error", "message": str(e)}

    async def _process_dataframe(self, df: pd.DataFrame):
        """
        Filters and normalizes the TOBB Excel data for the 'market_events' table.
        """
        # Note: We need to inspect columns after a real run, but typical TOBB exports have:
        # 'Fuar Adı', 'Şehir', 'Başlangıç Tarihi', 'Bitiş Tarihi', 'Konu'
        
        # Mapping for normalization
        # These column names might need adjustment after a test run on the actual site.
        col_map = {
            "Fuar Adı": "name",
            "Şehir": "city",
            "Başlangıç Tarihi": "start_date",
            "Bitiş Tarihi": "end_date",
            "Konu": "description"
        }
        
        # Rename if columns exist
        found_cols = [c for c in col_map.keys() if c in df.columns]
        df = df[found_cols].rename(columns=col_map)
        
        # Filter by relevant cities
        df['city_upper'] = df['city'].str.upper()
        filtered_df = df[df['city_upper'].isin(self.RELEVANT_CITIES)].copy()
        
        processed_count = 0
        for _, row in filtered_df.iterrows():
            event_data = {
                "name": row['name'],
                "type": "fair",
                "city": row['city'].capitalize(),
                "start_date": self._parse_date(row['start_date']),
                "end_date": self._parse_date(row['end_date']),
                "description": f"Konu: {row.get('description', 'N/A')}",
                "compression_score": 5, # Initial default for fairs
                "metadata": {
                    "source": "TOBB",
                    "original_city": row['city']
                }
            }
            
            # Upsert logic to avoid duplicates (Name + Start Date uniqueness)
            try:
                self.db.table("market_events").upsert(
                    event_data, 
                    on_conflict="name, start_date" # We need to ensure we have a unique constraint
                ).execute()
                processed_count += 1
            except Exception as e:
                logger.warning(f"[TOBBScraper] Upsert failed for {row['name']}: {e}")

        logger.info(f"[TOBBScraper] Processed {processed_count} relevant fairs.")
        return {"status": "success", "processed": processed_count}

    def _parse_date(self, date_val):
        """Helper to handle various date formats from Excel."""
        if isinstance(date_val, str):
            try:
                return datetime.strptime(date_val, "%d.%m.%Y").date().isoformat()
            except:
                return datetime.now().date().isoformat()
        return date_val.date().isoformat() if hasattr(date_val, 'date') else datetime.now().date().isoformat()
