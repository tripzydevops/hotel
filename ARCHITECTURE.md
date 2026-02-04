# Hotel Rate Sentinel Technical Architecture

## 🏗️ 3-Layer Architecture

This project follows a strict 3-Layer Architecture to solve the "Cold Start" problem in travel recommendations.

### LAYER 1: User Interface & Signal Collection

- **Frontend:** Next.js (Web) / React Native (Mobile)
- **Signal Collection:** Implemented a "User Signal Collection Module" that buffers interactions.
- **Recent Update:** Reports page localization and currency selection for enterprise-grade analytics.

### LAYER 2: Autonomous Reasoning Engine (The "Brain")

- **Architecture:** Transitioned to an **Agent-Mesh** structure (Orchestrator, Scraper, Analyst, Notifier).
- **Backend:** Python (FastAPI).
- **Discovery Engine:** Autonomous "Ghost Competitor" discovery using Gemini embeddings and `pgvector`.
- **Strategic Benchmarking:** Implemented **ARI (Average Rate Index)** and **GRI (Sentiment Index)** to normalize market positioning.
- **Logic:** Autonomous Quadrant Advisor analyzes Price vs. Value to provide revenue management "So What?" reasoning.
- **Reasoning:** Gemini-compatible reasoning engine explains recommendation logic based on market spread.

### LAYER 3: Data & Algorithms (The Infrastructure)

- **Database:** Supabase (PostgreSQL)
- **Vector Search:** `pgvector` enabled with HNSW indexing for high-speed semantic matchmaking.
- **Embeddings:** 768-dimensional vectors generated via Gemini (`embedding-001`) for hotel metadata.
- **Recommendation:** Hybrid approach (Collaborative Filtering + Vector-Based Semantic Search).
- **Location Discovery:** Self-learning `location_registry` that standardizes market data through hierarchical selection and autonomous ingestion during hotel creation.

## 📊 Core Features

### 1. Market Intelligence Reports

- **Localization:** Full support for EN/TR locales with dynamic dictionaries.
- **Currency Normalization:** Real-time conversion between USD, EUR, TRY, and GBP for competitor analysis.
- **Export:** High-quality PDF and CSV export for revenue management.

### 2. Autonomous Monitoring

- **SerpApi Integration:** Automated extraction of market hotel rates.
- **Enterprise Gating:** Room-level intelligence gated for Enterprise tier users.

## 🛰️ UI/UX Design Standard (2026 Refit)

The user has explicitly approved and locked in the **Agentic Command Center** aesthetic as the only valid UI direction for the 2026 overhaul.

### Design Principles

- **Aesthetic**: Modern-Premium (Linear.app / Vercel style).
- **Theme**: Deep Ocean (#0B1F3B) with Soft Gold (#D4AF37) accents.
- **Layout**: 3-Pane Modular Grid (Navigation | Market Analysis | Agent AI).
- **Data Density**: High-density information presentation.
- **Typography**: Inter (UI) and **Fira Code** (Numerical/Technical Data).
- **Restrictions**:
  - **NO** Glows, pulses, or radial gradients.
  - **NO** Mesh backgrounds or blurs.
  - **NO** Retro terminal effects.
  - **YES** Shadowless 1px borders (#ffffff10) and sharp, technical layouts.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons, Recharts.
- **Backend:** Python 3.11+, FastAPI, Pydantic, Supabase-py.
- **Intelligence:** SerpApi, Gemini (LLM).
