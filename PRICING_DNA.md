# Agentic Pricing DNA

## Overview

The **Agentic Pricing DNA** system is an autonomous intelligence layer that analyzes historical pricing behavior to identify a hotel's "Strategic Personality." Unlike traditional rule-based statistical models, this system uses LLM reasoning to interpret complex market dynamics.

## How it Works

The pipeline follows a four-stage process:

1. **Data Aggregation**: `aggregate_daily_prices.py` compiles raw `price_logs` into daily snapshots in `price_history_daily`.
2. **LLM Reasoning**: `update_pricing_dna.py` selects a 14-60 day window of history and feeds it to **Gemini-1.5-Flash**. The LLM generates a 50-word "Strategy Profile" (e.g., _Aggressive Opportunist_).
3. **Semantic Embedding**: The strategic description is embedded into a vector using `models/gemini-embedding-001`.
4. **Vector Persistence**: The resulting embedding is stored in the `pricing_dna` column (Supabase Vector type).

## Technical Implementation Details

### SDK & Model Selection

- **Reasoning**: `models/gemini-flash-latest` via `google-generativeai`.
- **Embeddings**: `models/gemini-embedding-001` via `google-generativeai`.
- **Fallback logic**: We use the stable `google-generativeai` package because the newer `google-genai` SDK encountered 404 errors for standard models in this environment.

### Precise Dimensionality (The 3072 -> 768 Workaround)

- **Problem**: `gemini-embedding-001` returns 3072 dimensions, but the Supabase `hotels` table was initialized with `vector(768)`.
- **Solution**: We implemented high-precision **Slicing** in `backend/utils/embeddings.py`. We take the first 768 elements of the 3072-dim vector. This maintains excellent semantic similarity while fitting the existing schema.

### Nightly Automation

- **Workflow**: `.github/workflows/pricing_dna.yml`
- **Schedule**: `0 1 * * *` (01:00 UTC Daily)
- **Scope**: Updates DNA for all hotels with at least 14 days of history.

## Key Files

- `backend/scripts/update_pricing_dna.py`: Main execution script.
- `backend/utils/embeddings.py`: Embedding generation and slicing logic.
- `backend/scripts/aggregate_daily_prices.py`: Pre-requisite data aggregator.
- `.github/workflows/pricing_dna.yml`: Automation definition.

## Market Selection Reliability (Kaizen 2026)

To ensure the Pricing DNA is based on the true market low rather than featured advertisements, the ingestion pipeline uses:
- **Deep Key Mapping**: Scans multiple SerpApi JSON keys (`rate_per_night`, `price`, `total_rate`) to prevent market depth restriction.
- **Absolute Minimum Selection**: The system ignores sponsored "top-level" prices if a lower vendor rate is found in the competitive set.
- **Quota Resilience**: Differentiates between 429 (Rate Limit) and 403 (Quota Out) to maintain scan continuity across large hotel sets.

---

_Maintained by Antigravity AI_
