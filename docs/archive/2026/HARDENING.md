# Infrastructure & Security Hardening (April 2026)

This document summarizes the specific hardening measures implemented to ensure production stability and security, adhering to the project's engineering rules.

## 🛡️ Security: Error Scrubbing
To prevent information leakage (e.g., database connection strings, file paths, or raw stack traces), a global exception handler has been implemented.

- **Centralized Handler**: `backend/main.py` contains a global `Exception` and `HTTPException` handler.
- **Scrubbing Logic**: Any exception with a status code `>= 500` is intercepted. The response body is replaced with a generic `"Internal Server Error"` message.
- **Service Integration**: Services (like `AdminService`) must raise standard `HTTPException`s to allow proper propagation while still being scrubbed if they represent unhandled server failures.

## ⚙️ Configuration: Centralized Proxy
Legacy configurations were spread across `vercel.json` and `next.config.ts`, leading to duplication and potential CORS issues.

- **Locked Proxies**: All proxying for `/auth/v1/`, `/rest/v1/`, and `/api/` is now strictly managed in `next.config.ts` using Next.js Rewrites.
- **Unified Headers**: Access control and security headers are injected directly via `next.config.ts` headers logic.
- **Vercel Cleanup**: `vercel.json` has been simplified to focus solely on build settings (Python/Next.js) and API routing to the FastAPI backend.

## 📦 Dependency: locked Styles
- **Tailwind CSS**: Explicitly locked to `3.4.14` in `package.json` and `PROJECT_STANDARDS.md`.
- **Constraint**: Upgrading to Tailwind 4+ is currently prohibited as it breaks the project's existing PostCSS and Turbopack pipelines.

## 🔗 Infrastructure
- **Environment-Driven URLs**: Hardcoded fallbacks to `localhost:3000` have been removed from `lib/insforge.ts`. The system now relies entirely on `NEXT_PUBLIC_SUPABASE_URL` for BaaS connectivity.

---
*Documentation generated after successful production build and manual verification.*
