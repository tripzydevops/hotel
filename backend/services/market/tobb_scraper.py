"""
TOBB Fair Calendar Scraper — Direct HTML Table Parser.
Extracts trade fair data from https://fuarlar.tobb.org.tr/FuarTakvimi
using direct HTTP + BeautifulSoup. No Firecrawl, no Gemini AI required.
"""
import re
from datetime import date, datetime
from typing import Any, Dict, List

import httpx
from bs4 import BeautifulSoup

from backend.utils.logger import get_logger
from supabase import Client

logger = get_logger(__name__)

# ── Compression Score Heuristics ─────────────────────────────────────────
# International fairs generate significantly more hotel demand than local ones.
FAIR_TYPE_SCORES = {
    "uluslararası ihtisas": 8,      # International specialized
    "uluslararası genel": 7,         # International general
    "ulusal ihtisas": 5,             # National specialized
    "ulusal genel": 4,               # National general
    "yöresel ihtisas": 3,            # Regional specialized
    "yöresel genel": 2,              # Regional general
}

# High-impact subjects that drive hotel bookings
HIGH_IMPACT_KEYWORDS = [
    "turizm", "otel", "gıda", "inşaat", "enerji", "otomotiv",
    "tekstil", "sağlık", "teknoloji", "savunma", "tarım",
    "mobilya", "mücevher", "kozmetik", "ambalaj",
]

# Turkish city name normalization map
CITY_NORMALIZE = {
    "İSTANBUL": "Istanbul",
    "İstanbul": "Istanbul",
    "ISTANBUL": "Istanbul",
    "ANTALYA": "Antalya",
    "İZMİR": "Izmir",
    "IZMIR": "Izmir",
    "ANKARA": "Ankara",
    "MUĞLA": "Mugla",
    "MUGLA": "Mugla",
    "BURSA": "Bursa",
    "MERSİN": "Mersin",
    "MERSIN": "Mersin",
    "GAZİANTEP": "Gaziantep",
    "GAZIANTEP": "Gaziantep",
    "KOCAELİ": "Kocaeli",
    "KOCAELI": "Kocaeli",
    "KONYA": "Konya",
    "ADANA": "Adana",
    "ESKİŞEHİR": "Eskisehir",
    "ESKISEHIR": "Eskisehir",
    "KAYSERİ": "Kayseri",
    "KAYSERI": "Kayseri",
    "TRABZON": "Trabzon",
    "DENİZLİ": "Denizli",
    "DENIZLI": "Denizli",
    "SAKARYA": "Sakarya",
    "BALIKESİR": "Balikesir",
    "BALIKESIR": "Balikesir",
    "DİYARBAKIR": "Diyarbakir",
    "DIYARBAKIR": "Diyarbakir",
    "ŞANLIURFA": "Sanliurfa",
    "SANLIURFA": "Sanliurfa",
    "MALATYA": "Malatya",
    "SAMSUN": "Samsun",
    "VAN": "Van",
    "EDİRNE": "Edirne",
    "EDIRNE": "Edirne",
    "AFYONKARAHİSAR": "Afyon",
}


class TOBBScraper:
    """
    Extracts the Turkish Fair Calendar from TOBB using direct HTTP + BeautifulSoup.
    Parses the HTML table directly — no JS rendering or AI needed.
    """

    URL = "https://fuarlar.tobb.org.tr/FuarTakvimi"

    def __init__(self, db: Client):
        self.db = db

    async def scrape_to_supabase(self) -> Dict[str, Any]:
        """
        Main entry point. Fetches the TOBB fair calendar page,
        parses the HTML table, and upserts events into Supabase.
        """
        logger.info("[TOBBScraper] Starting direct HTTP scrape...")
        try:
            # 1. Fetch the page
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
                resp = await http.get(self.URL, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })

            if resp.status_code != 200:
                logger.error(f"[TOBBScraper] HTTP {resp.status_code}")
                return {"status": "error", "message": f"HTTP {resp.status_code}"}

            logger.info(f"[TOBBScraper] Fetched {len(resp.text)} chars of HTML")

            # 2. Parse the HTML table
            events = self._parse_fair_table(resp.text)
            logger.info(f"[TOBBScraper] Parsed {len(events)} fairs from table")

            # 3. Filter for future events only
            today = date.today()
            future_events = [e for e in events if e.get("end_date") and e["end_date"] >= str(today)]
            logger.info(f"[TOBBScraper] {len(future_events)} upcoming fairs (from {today})")

            # 4. Upsert into Supabase
            processed = 0
            errors = 0
            for event in future_events:
                try:
                    self.db.table("market_events").upsert(
                        event, on_conflict="name, start_date"
                    ).execute()
                    processed += 1
                except Exception as e:
                    errors += 1
                    logger.warning(f"[TOBBScraper] Upsert failed for {event.get('name')}: {e}")

            result = {
                "status": "success",
                "total_parsed": len(events),
                "future_events": len(future_events),
                "processed": processed,
                "errors": errors,
            }
            logger.info(f"[TOBBScraper] Done: {result}")
            return result

        except Exception as e:
            logger.error(f"[TOBBScraper] Scraping failed: {e}")
            return {"status": "error", "message": str(e)}

    # Keep old method name as alias for backward compatibility
    scrape_to_insforge = scrape_to_supabase

    def _parse_fair_table(self, html: str) -> List[Dict[str, Any]]:
        """
        Parses the TOBB fair calendar HTML table into structured event dicts.
        Table columns (Turkish):
          0: Sıra No (Row #)
          1: Başlangıç Tar. (Start Date — DD.MM.YYYY)
          2: Bitiş Tar. (End Date — DD.MM.YYYY)
          3: Fuarın Adı (Fair Name)
          4: Konusu (Subject)
          5: Başlıca Ürün Hizmet Grupları (Main Products)
          6: Türü (Type: Uluslararası/Ulusal/Yöresel + İhtisas/Genel)
          7: Fuar Yeri (Venue)
          8: Şehir (City)
          9: Düzenleyici (Organizer)
        """
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table")
        if not table:
            logger.error("[TOBBScraper] No table found in HTML")
            return []

        rows = table.find_all("tr")
        events = []

        for row in rows[1:]:  # Skip header row
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 9:
                continue

            # Skip empty rows
            if not cells[1] or not cells[3]:
                continue

            try:
                start_date = self._parse_date(cells[1])
                end_date = self._parse_date(cells[2])
                name = cells[3].strip()
                subject = cells[4].strip()
                fair_type = cells[6].strip().lower() if len(cells) > 6 else ""
                raw_city = cells[8].strip() if len(cells) > 8 else "Unknown"

                # Normalize city name to English
                city = self._normalize_city(raw_city)

                # Calculate compression score from fair type and subject
                compression = self._calculate_compression(fair_type, subject, name)

                # Calculate fair duration in days
                duration = 1
                if start_date and end_date:
                    try:
                        d1 = datetime.strptime(start_date, "%Y-%m-%d")
                        d2 = datetime.strptime(end_date, "%Y-%m-%d")
                        duration = max((d2 - d1).days, 1)
                    except ValueError:
                        pass

                event = {
                    "name": name[:255],  # Truncate to fit DB column
                    "type": "fair",
                    "city": city,
                    "start_date": start_date,
                    "end_date": end_date,
                    "description": subject[:500] if subject else None,
                    "compression_score": compression,
                    "metadata": {
                        "source": "TOBB",
                        "fair_type": fair_type,
                        "venue": cells[7].strip() if len(cells) > 7 else None,
                        "organizer": cells[9].strip() if len(cells) > 9 else None,
                        "duration_days": duration,
                    },
                }
                events.append(event)

            except Exception as e:
                logger.debug(f"[TOBBScraper] Skipping row: {e}")
                continue

        return events

    def _parse_date(self, date_str: str) -> str:
        """Converts DD.MM.YYYY to ISO YYYY-MM-DD."""
        if not date_str:
            return ""
        # Handle DD.MM.YYYY format
        match = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", date_str.strip())
        if match:
            return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
        return date_str

    def _normalize_city(self, raw_city: str) -> str:
        """Normalizes Turkish city names to English title case."""
        city = raw_city.strip()
        # Direct lookup
        if city in CITY_NORMALIZE:
            return CITY_NORMALIZE[city]
        # Uppercase lookup
        if city.upper() in CITY_NORMALIZE:
            return CITY_NORMALIZE[city.upper()]
        # Fallback: basic transliteration
        return (
            city.replace("İ", "I")
            .replace("ı", "i")
            .replace("ş", "s")
            .replace("Ş", "S")
            .replace("ğ", "g")
            .replace("Ğ", "G")
            .replace("ü", "u")
            .replace("Ü", "U")
            .replace("ö", "o")
            .replace("Ö", "O")
            .replace("ç", "c")
            .replace("Ç", "C")
            .title()
        )

    def _calculate_compression(self, fair_type: str, subject: str, name: str) -> int:
        """
        Calculates a demand compression score (1-10) based on fair type and subject.
        International specialized fairs with high-impact subjects score highest.
        """
        # Base score from fair type
        base = 4  # Default
        for key, score in FAIR_TYPE_SCORES.items():
            if key in fair_type:
                base = score
                break

        # Boost for high-impact subjects
        combined = (subject + " " + name).lower()
        boost = 0
        for keyword in HIGH_IMPACT_KEYWORDS:
            if keyword in combined:
                boost += 1

        # Cap boost at +2
        boost = min(boost, 2)

        return min(base + boost, 10)
