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

## 📚 Technical Documentation

Deep dives into the platform core:
-   **[Price Monitoring & Notifications](docs/PRICE_MONITORING_SYSTEM.md)**: Architecture of the autonomous rate pulse and parity bot.
-   **[Database Architecture](docs/DATABASE_ARCHITECTURE_GUIDE.md)**: M2M relationship scaling and Pricing DNA.
-   **[Discovery Engine](DISCOVERY_ENGINE.md)**: Vector-based semantic hotel mapping.
-   **[Sentinel Protocol](SENTINEL_PROTOCOL.md)**: Autonomous Monitoring & "Token-First" Strategy.

### 🛡️ Compliance & Certification Readiness
As part of onboarding readiness for major enterprise hotel chains (e.g., Marriott, Hilton, IHG):
-   **[PCI Scope Exclusion Statement](PCI_SCOPE_EXCLUSION.md)**: Declaration and mapping criteria for SAQ-A scope exclusion.
-   **[Access Control & Auth Policy](docs/ACCESS_CONTROL_POLICY.md)**: Formal PoLP rules, active user-tenant RLS boundaries, and strict administrative/operator MFA TOTP enforcements.
-   **[Data Retention & Purge Policy](docs/DATA_RETENTION.md)**: Details of data scrubbers and automated GDPR/KVKK DSAR anonymization + erasure logic.
-   **[Incident Response Plan](docs/INCIDENT_RESPONSE_PLAN.md)**: SLA containment runbook and security breach notification protocols (GDPR Art. 33).
-   **[Bilingual Data Processing Agreement (DPA)](app/(landing)/dpa/page.tsx)**: Standard B2B processor agreement integrated into the landing environment.
-   **[Security Scan & SAST Vulnerability Audit Report](scan_results_report.md)**: Comprehensive static safety audit records.
-   **[Bilingual Privacy Policy Page](app/(landing)/privacy/page.tsx)**: GDPR/KVKK and CCPA compliant privacy disclosure integrated into the B2B landing environment.


## 🚀 Getting Started

### Prerequisites

-   Node.js 20+
-   Python 3.11+ (3.12 Recommended)
-   InsForge Account
-   DataForSEO Credentials (Login & Password)

### Installation

1.  Clone the repository
2.  Install frontend dependencies: `npm install`
3.  Install backend dependencies:
    ```bash
    # Using uv (Recommended)
    cd api && uv sync
    
    # Or using standard venv
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
**Last Updated:** 2026-05-31 (B2B GDPR DSAR erasures, SOC 2 audit logs, DPA, WCAG outlines, and administrative MFA enforcements added for full compliance readiness)
