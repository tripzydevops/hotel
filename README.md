# Hotel Rate Sentinel 🚀 (Enterprise Core)

**Hotel Rate Sentinel** is a next-generation travel intelligence platform designed to solve the "Cold Start" problem using Autonomous Agents and LLM-based reasoning.

## 🏗️ Technical Architecture (Serverless Core)

We utilize a **Serverless-First Strategy** to ensure high availability and low maintenance:

1.  **Backend & Frontend (Vercel)**:
    -   Next.js 14 (App Router)
    -   FastAPI Backend (Serverless Function)
    -   **Background Scans**: Powered by FastAPI `BackgroundTasks` for in-process, non-blocking AI execution.
2.  **Infrastructure**:
    -   **InsForge**: Relational (PostgreSQL) and Vector Storage (`pgvector`) via regional `eu-central` infrastructure.
    -   **Cron Management**: Multi-layered triggers (GitHub Actions + Cron) for scheduled monitoring with legacy bridging.

## 📊 Core Features

-   **Gemini 2026 (Gen 3) Intelligence 🧠**: Powered by `gemini-3-flash-preview` and `google-genai` SDK for autonomous market reasoning and "Deep Think" insights.
-   **Market Analysis**: Real-time price benchmarking against market averages.
-   **Rate Intelligence Grid**: 14-day lookahead comparison with "Strict Matching" for Suites.
-   **Discovery Engine 👻**: Autonomous "Ghost Competitor" identification using semantic vector search.
-   **Quadrant Visualization**: Dynamic 2x2 grid for strategic positioning.
-   **Strategic Reports**: Data-rich executive summaries with KPI snapshots and competitive battlefield tables.
-   **Diagnostic Dashboard 🛠️**: A dedicated `/debug` page for monitoring system health, environment variables, and Vercel serverless function status.
-   **Hybrid Room Config**: Dynamic room type mapping via Database (`room_tokens`, `room_aliases`) with static fallbacks.

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   Python 3.11+
-   Supabase Account
-   SerpApi Key

### Installation

1.  Clone the repository
2.  Install frontend dependencies: `npm install`
3.  Install backend dependencies:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
4.  Set up `.env` (See `.env.local` for the latest Supabase keys).

### Running Locally (Development)

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend (API & Background Tasks)
source .venv/bin/activate
uvicorn backend.main:app --reload

```

**Monitoring Scans:**
Track background scan progress via the `scan_sessions` table in Supabase or the `/debug` dashboard.

---

_Hotel Rate Sentinel R&D - 2026_
❤️ for the future of Autonomous Travel Intelligence.
**Last Updated:** 2026-02-27 (Redis Removal, Notification Fix & AI Optimization)
