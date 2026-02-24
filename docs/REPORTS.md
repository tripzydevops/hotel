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

- **6-Card KPI Snapshot**: Real-time monitoring of DRI, ARI, and price velocity metrics.
- **Experience Scorecard**: AI-driven guest sentiment visualization across key pillars (Cleanliness, Service, Value).
- **Competitive Battlefield**: Direct head-to-head benchmarking against top rivals.
- **Collapsible Scan History**: Auditable trail of recent market investigations.

### Internal Implementation
- **Frontend Layer**: `app/reports/page.tsx` manages the state for currency and rival selection.
- **KPI Components**: `components/analytics/KpiCards.tsx` (Phase 1 Redesign).
- **Sentiment Grid**: `components/analytics/ExperienceScorecard.tsx`.
- **Rival Table**: `components/analytics/CompetitiveBattlefield.tsx`.
- **Backend Analytics**: `backend/main.py` -> `get_analysis` aggregates logs using the target currency.
- **Reasoning Engine**: `backend/agents/analyst_agent.py` generates the narrative insights shown in the reports.

## 🛠️ Diagnostics & Troubleshooting
For deployment-specific issues (e.g., Vercel serverless environment), use the following tools:
- **System Report**: `/api/debug/system-report` (Checks DB, AI, and Env Vars).
- **Debug Dashboard**: Accessible via `/debug` route in the frontend.
