# Session Continuation: Backend Refactoring & Lint Audit

## Current State

- **Refactoring**: 100% complete for core API routes and services.
- **Routing**: Modularized into `backend/api/` (routes) and `backend/services/` (business logic).
- **Frontend lints**: ✅ [PASS] (`tsc`, `npm lint`).
- **Core Backend lints**: ✅ [PASS] (API files are clean).
- **Main.py**: Successfully updated to include all modular routers.

## Pending Items (Post-Push)

- **Utility Script Cleanup**: Several standalone scripts (`pdf_export.py`, `debug_history.py`) require `# ruff: noqa` or proper import management if they are to be integrated into the main app lifecycle.
- **Vercel specific**: `api/index.py` is aliased for Vercel deployment requirements.

## Troubleshooting Context

- `ruff` E741 (ambiguous name `l`) persists in some debug scripts.
- `ruff` F821 (missing `os`) in some debug scripts due to environment-loading hacks.

## Next Steps for AI Agent

1. Finalize `main.py` unused imports.
2. Ensure `pdf_export.py` does not block the build.
3. Commit and Push.
