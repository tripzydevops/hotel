# Hotel Rate Sentinel 🚀 (Enterprise Core)

**Hotel Rate Sentinel** is a next-generation travel intelligence platform designed to solve the "Cold Start" problem using Autonomous Agents and LLM-based reasoning.

## 🏗️ Technical Architecture (Hybrid Deployment)

We utilize a **Hybrid Deployment Strategy** to balance performance and capability:

1.  **Frontend & API (Vercel)**:
    -   Next.js 14 (App Router)
    -   FastAPI Backend (Serverless Function)
    -   Handles UI, User Management, and Light Data Requests.

2.  **Background Worker (VM / VPS)**:
    -   **Celery** + **Python 3.11**
    -   Handles Heavy Scraping (SerpApi), Data Analysis, and Long-Running Tasks.
    -   Managed via `systemd` for persistence.

3.  **Data & Infrastructure**:
    -   **Supabase**: Relational (PostgreSQL) and Vector Storage (`pgvector`).
    -   **Upstash Redis**: Cloud-hosted Redis queue bridging Vercel and the Worker VM.

## 📊 Core Features

-   **Gemini 2026 Intelligence 🧠**: Powered by `gemini-3-flash-preview` and `google-genai` SDK for autonomous market reasoning and "Deep Think" insights.
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
-   **Upstash Redis Database** (Required for background jobs)

### Installation

1.  Clone the repository
2.  Install frontend dependencies: `npm install`
3.  Install backend dependencies:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
4.  Set up `.env` (See `.env.example`).
    -   **Crucial:** Must include `REDIS_URL` (rediss://...) for Worker connection.

### Running Locally (Development)

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend (API)
source venv/bin/activate
uvicorn backend.main:app --reload

# Terminal 3: Celery Worker
source venv/bin/activate
celery -A backend.celery_app worker --loglevel=info
```

### 🔧 Production Maintenance

**Restarting the Worker:**
The worker is managed by `systemd`.
```bash
sudo systemctl restart hotel-worker
sudo systemctl status hotel-worker
```

**Viewing Logs:**
```bash
journalctl -u hotel-worker -f
```

---

_Hotel Rate Sentinel R&D - 2026_
❤️ for the future of Autonomous Travel Intelligence.
**Last Updated:** 2026-02-19 (Infrastructure Hardening & Hybrid Deploy)
