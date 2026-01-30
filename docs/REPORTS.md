# Reports & Localization Guide

This guide explains how the Reporting and Localization systems are implemented in Tripzy.travel.

## 🌍 Localization (i18n)

The project uses a custom context-based i18n system located in `lib/i18n.tsx`.

### Translation Dictionaries

- **English:** `dictionaries/en.ts`
- **Turkish:** `dictionaries/tr.ts`

### Usage in Components

```tsx
import { useI18n } from "@/lib/i18n";

const { t, locale, setLocale } = useI18n();
return <h1>{t("reports.title")}</h1>;
```

### Recent Fixes

- Added missing keys for `marketPosition`, `priceVelocity`, and `competitiveRank`.
- Localized hardcoded insights about market volatility and positioning.

## 💰 Currency Normalization

The Reports page supports multi-currency analysis to accommodate international users.

### Implementation Flow

1. **Frontend Selector:** The user selects a currency (USD, EUR, TRY, GBP) in `app/reports/page.tsx`.
2. **API Request:** The selected currency is sent as a query parameter to `/api/analysis/{user_id}`.
3. **Backend Conversion:** The backend (`backend/main.py`) fetches raw prices and converts them using the current exchange rates (via a `convert_currency` utility).
4. **Data Display:** The frontend receives converted prices and uses `Intl.NumberFormat` for localized display.

### Key Files

- **Frontend:** `app/reports/page.tsx`
- **Charts:** `components/analytics/MarketPositionChart.tsx`, `components/analytics/PriceTrendChart.tsx`
- **API Wrapper:** `lib/api.ts`
- **Backend Endpoint:** `backend/main.py` -> `get_analysis`

## 📈 Analysis Insights

The reports provide automated insights based on market data:

- **Market Position:** Compares target hotel price against market Min/Avg/Max.
- **Price Velocity:** Historical trend over the last 30 scans.
- **Competitive Rank:** Ranking among competitors (1 = cheapest).
- **Volatility Alert:** Notifies users if the price spread is unusually high.
