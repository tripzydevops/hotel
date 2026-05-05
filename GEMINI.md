# Gemini Agent Context: Tripzy - HotelPlus 🏨🚀

This document provides stable technical context for any AI agent interacting with this repository. 

> [!IMPORTANT]
> **PRIMARY SOURCE OF TRUTH**: Always read [ProjectArchitecture.md](file:///home/tripzydevops/hotel/ProjectArchitecture.md) BEFORE performing any task. It contains the complete inventory of agents, services, API routes, and database tables.

## 🏗️ Project Identity: "HotelPlus"
This project is an advanced hotel market intelligence and autonomous parity discovery platform.

## 🛡️ Stability & Core Stack (LOCKED)
> [!IMPORTANT]
> **DO NOT USE ANY EXPERIMENTAL OR UNSTABLE VERSIONS OF ANYTHING.**
> All dependencies are strictly pinned to proven stable versions to ensure production reliability.

| Component | Stable Version | Strict Requirement |
| :--- | :--- | :--- |
| **Next.js** | `15.1.11` | Mandatory for InsForge middleware stability. |
| **Tailwind CSS** | `3.4.14` | **DO NOT UPGRADE to v4.** Uses standard directives only. |
| **React** | `19.0.x` | Stable concurrent features. |
| **Node.js** | `>=20.0.0` | Target production runtime. |

## 📐 Architecture: 3-Layer Modular
1. **API Router Layer (`backend/api/`)**: Domain-isolated endpoints.
2. **Service Layer (`backend/services/`)**: Pure business logic, reusable by cron/tasks.
3. **Agent Layer (`backend/agents/`)**: Specialized LLMs for scraping, analysis, and notification.

## 💻 Coding Standards
- **Backend Isolation**: Use `.venv` for Python. Never install global packages.
- **Rewrites over CORS**: Use `next.config.ts` for API/Auth/Rest proxying.
- **Type Safety**: Enforce strict TS and Pyright checks.
- **Error Handling**: All 500+ errors must be scrubbed by `global_exception_handler`.

## 📁 Critical Directory Map
- `/backend/api`: FastAPI route definitions.
- `/backend/services`: Business logic and DB operations.
- `/components/analytics`: High-performance Recharts components.
- `/app/(dashboard)`: Main application view logic.
