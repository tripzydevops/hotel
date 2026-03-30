---
description: Development Guidelines for Hotel App (Vercel + InsForge)
globs: *
alwaysApply: true
---

# Hotel App Development Guidelines

## Architecture Overview

This project uses a hybrid architecture designed for performance and scalability:
- **Hosting**: [Vercel](https://vercel.com) (Frontend & Backend/API)
- **Deployment**: Integrated via GitHub Actions / Vercel Git integration.
- **BaaS (Backend-as-a-Service)**: [InsForge](https://insforge.com) provides the remote infrastructure for:
  - **Database**: PostgreSQL (managed via Supabase-compatible SDK)
  - **Authentication**: User identity and session management
  - **Storage**: Media and file hosting
  - **AI**: Integrated chat and generation services

## Environment Configuration

All infrastructure settings must be managed through environment variables. **Never hardcode service URLs.**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your InsForge BaaS endpoint URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for frontend operations |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** key for backend/administrative tasks (Vercel only) |

## Authentication Integration

- Use the `@insforge/sdk` for frontend session management.
- Backend verification is handled via `backend/services/auth_service.py` using standard JWT validation against the InsForge identity provider.

## Database Operations

- **Frontend**: Use the `supabase` client from `lib/insforge.ts`.
- **Backend**: Use `get_supabase_client` from `backend/utils/db.py`.
- **Note**: The backend utility handles the necessary path overrides to ensure compatibility with the InsForge PostgREST implementation.

## Security & CORS

- Local development uses `localhost:3000` (frontend) and `localhost:8000` (backend).
- Production hosting is on Vercel. 
- The API's `manual_cors_middleware` in `backend/main.py` is configured to trust `.vercel.app` domains. Ensure new custom domains are added there when launched.

## Important Engineering Rules
1. **Hosting**: Do **not** use InsForge for deployment or serverless functions. Use Vercel only.
2. **Dependencies**: Lock Tailwind CSS to 3.4.
3. **Internal Errors**: Never expose raw database or system traces to the client. Use the centralized error handling patterns.