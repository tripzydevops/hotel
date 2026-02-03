# Hotel Data API Provider Comparison

This document summarizes the research into alternative API providers for the Tripzy.travel recommendation engine. It focuses on "Free Tier" capabilities and failover strategies.

## 🏆 Quick Summary: The "Golden Stack"

| Role                  | Provider       | Free Tier          | Why?                                         |
| :-------------------- | :------------- | :----------------- | :------------------------------------------- |
| **Primary (Current)** | **SerpApi**    | 100/mo (free plan) | Robust, currently implemented, reliable.     |
| **Primary (Free)**    | **Decodo**     | **2,500/mo**       | **Best Value.** Dedicated Google Hotels API. |
| **Secondary (Free)**  | **Serper.dev** | 2,500/mo           | Fast, general Google Search JSON.            |
| **Backup**            | **RapidAPI**   | 500/mo             | Booking.com data (rich metadata).            |

---

## Detailed Provider Analysis

### 1. Decodo (Top Recommendation)

- **Website:** `decodo.com` (formerly specialized scraper services)
- **Free Tier:** **2,500 requests / month**
- **Type:** Specialized Google Hotels Scraper API.
- **Pros:**
  - Designed specifically for Hotel data (prices, amenities).
  - Handles proxy rotation and CAPTCHA automatically.
  - Python-friendly.
- **Cons:**
  - Less "mainstream" documentation than SerpApi.

### 2. Serper.dev

- **Website:** `serper.dev`
- **Free Tier:** **2,500 credits (one-time/monthly varies)**
- **Type:** General Google Search API.
- **Pros:**
  - Extremely fast.
  - Simple JSON structure.
  - Lowest latency for general SERP.
- **Cons:**
  - Returns "Search Results" (need to parse hotel card manually).
  - Less granular hotel-specific fields than Decodo.

### 3. RapidAPI (Booking.com)

- **Website:** `rapidapi.com/tipsters/api/booking-com`
- **Free Tier:** **500 requests / month**
- **Type:** OTA Wrapper (Online Travel Agency).
- **Pros:**
  - **Rich Data:** Returns images, extensive facility lists, and descriptions that Google sometimes misses.
  - Easy integration via RapidAPI Hub.
- **Cons:**
  - Hard cap at 500 (extra costs if exceeded).
  - Rate limited (often 1 request/second).

### 4. Amadeus

- **Website:** `developers.amadeus.com`
- **Free Tier:** **~2,000+ requests/mo** (Test Environment).
- **Type:** GDS (Global Distribution System).
- **Pros:**
  - Industry standard source.
  - Real-time "Offer" availability (bookable rates).
- **Cons:**
  - **Complexity:** Requires OAuth2 flow.
  - "Test Environment" data is limited (not full production inventory).

### 5. Apify

- **Website:** `apify.com`
- **Free Tier:** **$5.00 monthly credit** (approx. 1,700 results).
- **Type:** Universal Web Scraper.
- **Pros:**
  - Can scrape _anything_ (Booking, TripAdvisor, Airbnb).
  - Very flexible "Actors" (scripts).
- **Cons:**
  - Slower (spin up container -> scrape -> return).
  - Maintenance (scripts break if sites change).

### 6. DataForSEO

- **Website:** `dataforseo.com`
- **Pricing:** Pay-As-You-Go ($0.00075 / hotel).
- **Type:** Enterprise SEO Data.
- **Pros:**
  - Infinite scale (no monthly quota limits).
  - Cheaper than SerpApi at scale.
- **Cons:**
  - No "Free Tier" (paid only, though cheap).

---

## Implementation Strategy: "The Adapter Pattern"

To use these without rewriting code constantly, we will implement a **Provider Adapter**:

```python
class HotelDataProvider(ABC):
    @abstractmethod
    def fetch_price(self, hotel_name, check_in): pass

class DecodoProvider(HotelDataProvider): ...
class SerpApiProvider(HotelDataProvider): ...
```

**Configuration via `.env`:**

```ini
# Priority 1
DECODO_API_KEY=xyz
# Priority 2
SERPER_API_KEY=abc
# Fallback
RAPIDAPI_KEY=123
```
