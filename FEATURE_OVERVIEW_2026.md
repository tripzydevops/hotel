# Feature Overview 2026: Tripzy Intelligence Enhancements

This document details the major technical enhancements implemented in 2026 to improve system reliability and data intelligence.

## 1. Persistent Background Scheduler
**Status**: Live (VM Cron + GitHub Actions)

To resolve the "lazy cron" issue (where scans only triggered when a user was active on the frontend), we implemented a multi-layered background scheduling system.

### Architecture
- **Layer 1: System Cron (VM)**: A Linux cron job on the production VM triggers the scheduler logic every 15 minutes. This is the primary trigger.
- **Layer 2: GitHub Action**: A scheduled workflow serves as a robust backup, ensuring the schedule persists even if local VM services are interrupted.
- **Logic Isolation**: The core scheduling logic is encapsulated in `backend/services/monitor_service.py:run_scheduler_check_logic`, decoupled from the HTTP routing layer. Dispatched scans run in-process via FastAPI `BackgroundTasks`.

### Key Components
- [scripts/trigger_scheduler.sh](file:///home/tripzydevops/hotel/scripts/trigger_scheduler.sh): Fast entry point that executes the direct Python trigger.
- [backend/scripts/run_scheduler.py](file:///home/tripzydevops/hotel/backend/scripts/run_scheduler.py): Bridge script used by the cron job to invoke the service logic.
- `scheduler.log`: Dedicated audit trail for all background scan dispatches.

---

## 2. Smart Memory Sentiment Persistence
**Status**: Optimized (Cumulative Merging)

The "Smart Memory" system ensures that sentiment data is not just a snapshot of the latest scan, but a cumulative historical record of guest feedback.

### Key Features
- **Cumulative Merging**: Sentiment counts (positive, negative, etc.) for each category (e.g., Cleanliness, Service) are incremented with each new scan result rather than being overwritten.
- **Cross-Language Normalization**: A mapping utility (in `sentiment_utils.py`) reconciles Turkish and English keyword categories (e.g., merging "Hizmet" and "Service") to prevent duplicate keys and data fragmentation.
- **Centralized Analysis**: Merging logic is consolidated in the `AnalystAgent` to ensure that data enrichment (like Voice generation) is performed on the fully merged historical context.

### Technical Implementation
- [backend/utils/sentiment_utils.py](file:///home/tripzydevops/hotel/backend/utils/sentiment_utils.py): Contains `merge_sentiment_breakdowns` which implements the normalized merge strategy.
- [backend/agents/analyst_agent.py](file:///home/tripzydevops/hotel/backend/agents/analyst_agent.py): Uses the merge utility during result analysis before committing to the database.
- `debug_sentiment_health.py`: Utility script for verifying the integrity of merged sentiment data in the database.

---

## 3. Gemini 2026 Migration
**Status**: Live (`gemini-3-flash-preview`)

We migrated our AI reasoning layer to the latest Gemini models and SDKs to leverage superior market analysis capabilities and "Deep Think" reasoning traces.

### Infrastructure Changes
- **SDK Update**: Migrated from legacy `google-generativeai` to the modern `google-genai` SDK.
- **Model**: Standardized on `gemini-3-flash-preview` for its balance of speed and high-reasoning output.
- **Agentic ADK**: Implemented the **MarketIntelligenceAgent** using the Google Agent Development Kit (ADK), enabling autonomous tool usage (e.g., price drop validation) during analysis.

---

## 4. Strategic Reporting Redesign
**Status**: Live (Phase 1)

The Reports page was transformed from a simple chart view into a comprehensive executive dashboard for decision-makers.

### New UI Components
- **6-Card KPI Snapshot**: Immediate visibility into DRI, ARI, Market Position, and Price Velocity.
- **Experience Scorecard**: A clear visualization of Guest Sentiment across pillars (Cleanliness, Service, Value).
- **Competitive Battlefield**: A head-to-head comparison table against selected rivals.
- **Collapsible Scan History**: Streamlined access to historical scan logs without UI clutter.

---

## Technical Maintenance
- **Logs**: Monitor `scheduler.log` for background dispatch success.
- **Diagnostics**: Use `/api/debug/system-report` to verify DB and AI provider connectivity.
