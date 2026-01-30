# Tripzy.travel Technical Documentation

## 🏗️ 3-Layer Architecture

This project follows a strict 3-Layer Architecture to solve the "Cold Start" problem in travel recommendations.

### LAYER 1: User Interface & Signal Collection

- **Frontend:** Next.js (Web) / React Native (Mobile)
- **Signal Collection:** Implemented a "User Signal Collection Module" that buffers interactions.
- **Recent Update:** Reports page localization and currency selection for enterprise-grade analytics.

### LAYER 2: Autonomous Reasoning Engine (The "Brain")

- **Backend:** Python (FastAPI)
- **Strategic Benchmarking:** Implemented **ARI (Average Rate Index)** and **GRI (Sentiment Index)** to normalize market positioning.
- **Logic:** Autonomous Quadrant Advisor analyzes Price vs. Value to provide revenue management "So What?" reasoning.
- **Reasoning:** Gemini-compatible reasoning engine explains recommendation logic based on market spread.

### LAYER 3: Data & Algorithms (The Infrastructure)

- **Database:** Supabase (PostgreSQL)
- **Extended Schema:** Added `review_count` to track social proof volume for GRI calculations.
- **Vector Search:** `pgvector` for semantic hotel search.
- **Recommendation:** Hybrid approach (Collaborative Filtering + Vector-Based).

## 📊 Core Features

### 1. Market Intelligence Reports

- **Localization:** Full support for EN/TR locales with dynamic dictionaries.
- **Currency Normalization:** Real-time conversion between USD, EUR, TRY, and GBP for competitor analysis.
- **Export:** High-quality PDF and CSV export for revenue management.

### 2. Autonomous Monitoring

- **SerpApi Integration:** Automated extraction of market hotel rates.
- **Enterprise Gating:** Room-level intelligence gated for Enterprise tier users.

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons, Recharts.
- **Backend:** Python 3.11+, FastAPI, Pydantic, Supabase-py.
- **Intelligence:** SerpApi, Gemini (LLM).
