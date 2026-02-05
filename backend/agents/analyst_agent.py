from datetime import datetime, date
from typing import List, Optional, Dict, Any
from uuid import UUID
from supabase import Client
from backend.models.schemas import MarketAnalysis, PricePoint, ScanOptions
from backend.services.price_comparator import price_comparator
from backend.utils.helpers import convert_currency
from backend.utils.embeddings import get_embedding, format_hotel_for_embedding

class AnalystAgent:
    """
    Agent responsible for market analysis, price comparison, and reasoning.
    2026 Strategy: Uses high-reasoning models (Deep Think) to explain market shifts.
    """
    def __init__(self, db: Client):
        self.db = db

    async def analyze_results(
        self,
        user_id: UUID,
        scraper_results: List[Dict[str, Any]],
        threshold: float = 2.0,
        threshold: float = 2.0,
        options: Optional[ScanOptions] = None,
        session_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Analyzes scraped data, logs prices, and detects alerts. (Now with Reasoning Trace)"""
        analysis_summary = {
            "prices_updated": 0,
            "alerts": [],
            "target_price": None
        }
        
        reasoning_log = [] # Ordered trace of decisions

        # 1. Persistence & Analysis Loop
        for res in scraper_results:
            try:
                hotel_id = res["hotel_id"]
                price_data = res["price_data"]
                status = res["status"]
                
                if status != "success" or not price_data:
                    print(f"[AnalystAgent] Skipping {hotel_id} - status: {status}")
                    continue

                current_price = price_data.get("price", 0.0)
                currency = price_data.get("currency", "TRY")
                
                reasoning_log.append(f"[Start] Analyzing {hotel_id}. Raw Price: {current_price} {currency}")
                
                # 2. Currency Normalization (if RapidAPI returns USD but TRY was expected)
                target_currency = options.currency if options and options.currency else "TRY"
                if currency == "USD" and target_currency == "TRY" and current_price > 0:
                    print(f"[AnalystAgent] Converting {current_price} USD to TRY for {hotel_id}")
                    old_price = current_price
                    current_price = convert_currency(current_price, "USD", "TRY")
                    currency = "TRY"
                    reasoning_log.append(f"[Normalization] Converted {old_price} USD -> {current_price} TRY (Rate mismatch detected)")

                # 3. Log to price_logs (This updates the dashboard)
                check_in = res.get("check_in")
                check_in_str = check_in.isoformat() if hasattr(check_in, "isoformat") else str(check_in)
                
                self.db.table("price_logs").insert({
                    "hotel_id": hotel_id,
                    "price": current_price,
                    "currency": currency,
                    "check_in_date": check_in_str,
                    "source": price_data.get("source", "serpapi"),
                    "vendor": price_data.get("vendor", "Unknown"),
                    # Deep Data: Parity Offers & Room Metadata
                    "parity_offers": price_data.get("offers", []), # Mapped from 'offers' in scraper to 'parity_offers' in DB
                    "room_types": price_data.get("room_types", [])
                }).execute()
                analysis_summary["prices_updated"] += 1
                
                # 4. Update hotel meta (Dashboard card metadata)
                vendor = price_data.get("vendor") or price_data.get("source", "SerpApi")
                meta_update = {
                    "current_price": current_price,
                    "currency": currency,
                    "last_scan": datetime.now().isoformat(),
                    "vendor_source": vendor
                }
                
                if price_data.get("rating"): meta_update["rating"] = price_data["rating"]
                if price_data.get("property_token"): meta_update["serp_api_id"] = price_data["property_token"]
                if price_data.get("image_url"): meta_update["image_url"] = price_data["image_url"]
                if price_data.get("reviews_breakdown"): meta_update["sentiment_breakdown"] = price_data["reviews_breakdown"]
                
                print(f"[AnalystAgent] Updating hotel {hotel_id} metadata: {meta_update}")
                update_res = self.db.table("hotels").update(meta_update).eq("id", hotel_id).execute()
                print(f"[AnalystAgent] Update result for {hotel_id}: {update_res.data}")
                
                # 4b. Insert Sentiment History (New Quality Velocity)
                if price_data.get("rating"):
                     try:
                         self.db.table("sentiment_history").insert({
                             "hotel_id": hotel_id,
                             "rating": price_data.get("rating"),
                             "review_count": price_data.get("reviews", 0),
                             "sentiment_breakdown": price_data.get("reviews_breakdown", [])
                         }).execute()
                         reasoning_log.append(f"[Sentiment] Logged new rating {price_data.get('rating')} to history.")
                     except Exception as e:
                         print(f"[AnalystAgent] Sentiment history error: {e}")

                # 5. Check for Threshold Breaches (Comparison with Previous)
                prev_res = self.db.table("price_logs") \
                    .select("price, currency") \
                    .eq("hotel_id", hotel_id) \
                    .order("recorded_at", desc=True) \
                    .limit(2) \
                    .execute()
                
                if len(prev_res.data) > 1:
                    previous_price = prev_res.data[1]["price"]
                    previous_currency = prev_res.data[1].get("currency", "USD")
                    
                    # Normalize if currencies differ
                    if currency != previous_currency:
                        previous_price = convert_currency(previous_price, previous_currency, currency)

                    alert = price_comparator.check_threshold_breach(current_price, previous_price, threshold)
                    if alert:
                        reasoning_log.append(f"[Alert] BREACH Detected! Current: {current_price}, Prev: {previous_price}. Diff: {alert['change_percent']}%")
                        alert_data = {
                            "user_id": str(user_id),
                            "hotel_id": hotel_id,
                            "currency": currency,
                            **alert
                        }
                        analysis_summary["alerts"].append(alert_data)
                        # Persist Alert
                        self.db.table("alerts").insert(alert_data).execute()

            except Exception as e:
                print(f"[AnalystAgent] CRITICAL error processing hotel {res.get('hotel_id')}: {e}")
                import traceback
                traceback.print_exc()
                reasoning_log.append(f"[ERROR] Failed to process hotel {res.get('hotel_id')}: {str(e)}")
                continue

        # 4. Save Reasoning Trace to Session (if session_id provided)
        if session_id and reasoning_log:
            try:
                self.db.table("scan_sessions").update({
                    "reasoning_trace": reasoning_log
                }).eq("id", str(session_id)).execute()
                print(f"[AnalystAgent] Saved reasoning trace for session {session_id}")
            except Exception as e:
                print(f"[AnalystAgent] Failed to save reasoning trace: {e}")

        # 4. Competitor Undercut Detection (Multi-hotel reasoning)
        target_res = [r for r in scraper_results if r.get("price_data") and r["price_data"].get("price") and any(h['id'] == r['hotel_id'] and h.get('is_target_hotel') for h in self._get_hotels(user_id))]
        # Note: In a real mesh, we'd pass the hotel list or fetch it once.
        # For efficiency, we'll assume the caller might pass the target price or we fetch it.
        # Let's keep it simple for now and just handle single-hotel alerts.
        
        return analysis_summary

    def _get_hotels(self, user_id: UUID):
        res = self.db.table("hotels").select("*").eq("user_id", str(user_id)).execute()
        return res.data or []

    async def discover_rivals(self, target_hotel_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Pillar 3: Autonomous Discovery.
        Uses vector search to find 'Ghost Competitors' in the directory.
        """
        try:
            # 1. Get Target Hotel Info from the master Directory
            target = self.db.table("hotel_directory").select("*").eq("id", target_hotel_id).single().execute()
            if not target.data:
                # If not in directory, try the user's hotels list
                target = self.db.table("hotels").select("*").eq("id", target_hotel_id).single().execute()
                
            if not target.data:
                return []
            
            # 2. Generate Embedding for Target (if not exists in directory yet)
            target_embedding = target.data.get("embedding")
            if not target_embedding:
                text = format_hotel_for_embedding(target.data)
                target_embedding = await get_embedding(text)
                
            # 3. Perform Vector Search (RPC)
            res = self.db.rpc("match_hotels", {
                "query_embedding": target_embedding,
                "match_threshold": 0.5,
                "match_count": limit,
                "target_hotel_id": target_hotel_id
            }).execute()
            
            return res.data or []
        except Exception as e:
            print(f"[AnalystAgent] Discovery error: {e}")
            return []
