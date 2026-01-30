# Tripzy.travel Technical Documentation

## 🏗️ 3-Layer Architecture

This project follows a strict 3-Layer Architecture to solve the "Cold Start" problem in travel recommendations.

### LAYER 1: User Interface & Signal Collection

- **Frontend:** Next.js (Web) / React Native (Mobile)
- **Signal Collection:** Implemented a "User Signal Collection Module" that buffers interactions.
- **Recent Update:** Reports page localization and currency selection for enterprise-grade analytics.

### LAYER 2: Autonomous Reasoning Engine (The "Brain")

- **Backend:** Python (FastAPI)
- **Logic:** Autonomous Agents manage data and reasoning.
- **Reasoning:** Gemini-compatible reasoning engine explains recommendation logic.

### LAYER 3: Data & Algorithms (The Infrastructure)

- **Database:** Supabase (PostgreSQL)
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
