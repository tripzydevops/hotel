# Hotel Project: Technical Standards & Requirements

This document serves as the "Source of Truth" for the project's architecture and technology stack to prevent the regression to experimental versions and ensure production stability.

## 1. Core Technology Stack (Locked)

| Component | Stable Version | Rationale |
| :--- | :--- | :--- |
| **Next.js** | `^15.x` | Required for compatibility with InsForge middleware and stable Vercel builds. |
| **Tailwind CSS** | `3.4.14` (Locked) | Prevents `ScannerOptions` errors and ensures PostCSS pipeline stability. **Do not upgrade.** |
| **React** | `19.0.x` | Standard minor version for the current feature set. Avoid `19.2.x` until peer dependencies align. |
| **Node.js** | `>=20.0.0` | Production runtime standard. |

## 2. Configuration Standards

### Tailwind & CSS
- **Do not use `@import "tailwindcss"`**: Always use the standard directives (`@tailwind base`, etc.) in `globals.css`.
- **Maintain `tailwind.config.ts`**: All design tokens (colors, fonts) must be defined here for IDE support and consistent branding.
- **PostCSS**: Use the standard `tailwindcss` and `autoprefixer` plugins in `postcss.config.mjs`.

### API & Backend Integration
- **Rewrites over CORS**: Always use `next.config.ts` rewrites for `/api/:path*`, `/auth/v1/:path*`, and `/rest/v1/:path*`.
- **Backend URL**: Strictly environment-driven via `NEXT_PUBLIC_SUPABASE_URL`. No hardcoded fallbacks allowed in `lib/` or `services/`.
- **Backend Isolation**: Use the `.venv` virtual environment for all Python-based backend services. Avoid installing packages globally.
- **Unified Structure**: All backend logic must reside in `backend/` (services/tasks) or `api/` (routes), following the consolidated structure.

## 3. Development Workflow
- **Build Verification**: Every major change *must* be verified with `npm run build` locally before pushing.
- **Dependency Management**: Use `requirements.txt` for Python dependencies and `package.json` for frontend.
- **Type Safety**: The project enforces strict TypeScript rules and Pyright/Pylance for Python via `.venv`.

## 4. Security Standards
- **Error Scrubbing**: The backend `global_exception_handler` MUST catch and scrub all `500+` exceptions. Never return raw `ValueError`, `DBError`, or tracebacks to the client.
- **Service Validation**: Services must raise `HTTPException` with appropriate status codes to ensure standard handling.
- **Header Security**: Next.js proxying must include standard security headers (`Access-Control-Allow-Origin`, etc.) as defined in `next.config.ts`.

## 5. Known Gotchas
- **Building xhtml2pdf**: Requires `gcc` which may be missing in some environments; use pure-python alternatives like `fpdf2` if compilation fails.
- **Leaflet Type Definitions**: Always ensure `@types/leaflet` is present in `devDependencies` if using map components.
- **Turbopack Compatibility**: Tailwind 4 features are currently incompatible with the project's Turbopack build pipeline.
