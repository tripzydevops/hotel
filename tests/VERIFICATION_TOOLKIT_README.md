# 🔍 Verification Toolkit — README

> **Modular integration testing tools** that catch bugs static analysis can't.
> Drop into any Next.js + Python backend project.

---

## Why This Exists

We lost **2+ hours** debugging analysis pages that showed "N/A" everywhere. The root cause? The frontend called `GET /api/analysis/{userId}` but the backend only had `POST /api/analysis/market/{user_id}`. Linting and TypeScript checks both passed — the bug lived **in the gap between files**.

These tools close that gap.

---

## What's Included

| File | Purpose | Catches |
|------|---------|---------|
| [route_contract_test.py](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/tests/route_contract_test.py) | Cross-checks frontend API calls against backend routes | Wrong HTTP method, missing routes, path mismatches |
| [i18n_validator.py](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/tests/i18n_validator.py) | Checks all `t()` translation keys exist in dictionaries | Raw key display, missing translations |
| [.audit.json](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/.audit.json) | Project-specific config (paths, function names) | — |
| [full-audit.md](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/.agent/workflows/full-audit.md) | 5-phase audit workflow for the AI agent | Ensures nothing gets skipped |

---

## Quick Start

### Run on this project (auto-detect)
```bash
python3 tests/route_contract_test.py
python3 tests/i18n_validator.py
```

### Run with config file
```bash
python3 tests/route_contract_test.py --config .audit.json
python3 tests/i18n_validator.py --config .audit.json
```

### Run on a different project
```bash
python3 tests/route_contract_test.py --frontend src/api.ts --backend server/routes/
python3 tests/i18n_validator.py --components src/ --dicts locales/en.json locales/fr.json
```

---

## Tool 1: Route Contract Test

### What it does
Reads every function in your frontend API client (e.g., `lib/api.ts`) and extracts the HTTP method + path. Then reads every route decorator in your backend (e.g., `@router.get("/path")`) and cross-references them.

### What it catches

| Bug Type | Example | Impact |
|----------|---------|--------|
| **Method mismatch** | Frontend sends `GET`, backend expects `POST` | Silent 405 error, page shows "No Data" |
| **Path mismatch** | Frontend: `/api/analysis/{id}`, Backend: `/api/analysis/market/{id}` | 404, all KPIs show N/A |
| **Missing route** | Frontend calls `/api/admin/plans`, no backend handler | Feature completely broken |

### CLI Options
```
--frontend, -f    Path to frontend API file (e.g., lib/api.ts)
--backend, -b     Path to backend routes directory (e.g., backend/api/)
--config, -c      Path to JSON config file
--json            Output as JSON (for CI/CD pipelines)
--project-root    Override project root detection
```

### Supported Frameworks
- **FastAPI** — `@router.get("/path")`, `@app.post("/path")`
- **Flask** — `@app.route("/path", methods=["GET"])`
- **Any TS/JS frontend** — detects `fetch()` and `this.fetch()` patterns

---

## Tool 2: i18n Key Validator

### What it does
Scans all component files for `t("dotted.key")` calls, then checks that every key exists in **all** dictionary files (both English and Turkish, or any locale).

### What it catches

| Bug Type | Example | Impact |
|----------|---------|--------|
| **Missing key** | `t("analysis.tabs.overview")` but key not in `en.ts` | Tab shows raw string "analysis.tabs.overview" |
| **Partial translation** | Key exists in `en.ts` but not `tr.ts` | Turkish users see English fallback or raw key |
| **Array access** | `t("subscription.pro.features.0")` but dict uses array | Key resolves to `undefined` |

### CLI Options
```
--components, -d  Directories to scan (e.g., components/ app/)
--dicts           Dictionary files (e.g., dictionaries/en.ts locales/fr.json)
--func-name       Translation function name (default: "t")
--config, -c      Path to JSON config file
--json            Output as JSON
```

### Supported Formats
- **TypeScript exports** — `export const en = { ... }`
- **JSON files** — `{ "key": "value" }`
- **Component files** — `.tsx`, `.ts`, `.jsx`, `.js`, `.vue`, `.svelte`

---

## Config File (`.audit.json`)

Create this in your project root to avoid repeating CLI args:

```json
{
  "frontend_api": "lib/api.ts",
  "backend_api_dir": "backend/api/",
  "api_prefix": "/api",
  "i18n_components": ["components/", "app/"],
  "i18n_dicts": ["dictionaries/en.ts", "dictionaries/tr.ts"],
  "i18n_function": "t"
}
```

### Adapting for another project

Just change the paths:

```json
{
  "frontend_api": "src/services/apiClient.ts",
  "backend_api_dir": "server/routes/",
  "i18n_components": ["src/"],
  "i18n_dicts": ["public/locales/en/translation.json", "public/locales/fr/translation.json"],
  "i18n_function": "useTranslation"
}
```

---

## Agent Workflow (`/full-audit`)

The [full-audit.md](file:///home/successofmentors/.gemini/antigravity/scratch/hotel/.agent/workflows/full-audit.md) workflow defines a **5-phase verification** the AI agent follows:

| Phase | What | Time |
|-------|------|------|
| 1. Static | `tsc --noEmit`, `npm run lint`, backend import | ~30s |
| 2. Contract | Route test + i18n validator | ~10s |
| 3. Runtime | API smoke test (needs auth token) | ~30s |
| 4. Browser | Load pages, screenshot errors | ~2min |
| 5. Report | Summarize findings, update task.md | ~1min |

> **Rule:** Never report "all checks pass" if only Phase 1 was run.

---

## First Run Results (This Project)

When we first ran these tools, they found:

- **14 route mismatches** — including missing CRUD routes for admin hotels, plans, settings
- **29 missing i18n keys** — 8 in `en.ts`, 21 in `tr.ts`

These are the exact bugs that caused the 2-hour debugging session. Had we run these tools first, total debug time: **~10 seconds**.
