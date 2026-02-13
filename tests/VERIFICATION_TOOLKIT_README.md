# Verification Toolkit

A modular, sub-200ms quality gate for the Hotel Rate Sentinel.  
Every tool runs standalone **or** together via the unified gate.

---

## Quick Start

```bash
# Run the full gate (all 4 checks)
python3 tests/gate.py

# Install as a git pre-push hook (one-time)
python3 tests/gate.py --install-hook
```

After installing the hook, every `git push` runs the gate automatically.  
Bypass when needed: `git push --no-verify`.

---

## Architecture

```
tests/
├── gate.py                  ← Orchestrator (runs all checks via subprocess)
├── i18n_validator.py        ← Translation key completeness
├── route_contract_test.py   ← Frontend ↔ Backend route alignment
├── schema_drift_test.py     ← Pydantic ↔ Database alignment
├── api_smoke_test.py        ← Live endpoint health (CI only, not in gate)
└── VERIFICATION_TOOLKIT_README.md
```

Each script is a **standalone CLI tool** with `--help`, `--json`, and auto-detection.  
The gate calls them as subprocesses — no imports, no coupling.

---

## The Gate (`gate.py`)

Runs all static checks in sequence and blocks pushes if critical checks fail.

| Check | Blocks Push? | What It Catches |
|:------|:-------------|:----------------|
| **i18n Validator** | ✅ Yes | Missing `t('key')` entries in dictionaries |
| **Route Contract** | ✅ Yes | Frontend calling routes that don't exist |
| **Schema Drift** | 🟡 Warns | Pydantic constraints that will reject DB data |
| **TS Any Audit** | ❌ Advisory | Untyped `Promise<any>` in `lib/api.ts` |

### Selective Execution

```bash
python3 tests/gate.py --only i18n routes   # Run specific checks
python3 tests/gate.py --skip schema        # Skip specific checks
python3 tests/gate.py --json               # JSON output for CI pipelines
```

### Adding a New Check

1. Create `tests/my_check.py` with exit code 0 = pass / 1 = fail.
2. Add one entry to the `CHECKS` dict in `gate.py`:

```python
"my_check": {
    "name": "My Check",
    "description": "What it does",
    "script": "tests/my_check.py",
    "args": [],
    "critical": True,  # True = blocks push, False = warning only
},
```

No other wiring needed.

---

## Individual Tools

### 1. i18n Validator (`i18n_validator.py`)

Scans `.tsx`/`.ts` files for `t('dotted.key')` calls and verifies every key exists in all dictionaries.

```bash
python3 tests/i18n_validator.py                          # Auto-detect
python3 tests/i18n_validator.py --config .audit.json     # From config
python3 tests/i18n_validator.py --json                   # Machine-readable
```

**Why it exists:** The `t()` function returns the key string on miss (truthy), so `t(key) || fallback` never triggers. Missing keys silently show raw strings.

---

### 2. Route Contract Test (`route_contract_test.py`)

Parses `lib/api.ts` for `fetch('/api/...')` calls and `backend/api/*.py` for `@router` decorators, then cross-references method + path.

```bash
python3 tests/route_contract_test.py                      # Auto-detect
python3 tests/route_contract_test.py --config .audit.json  # From config
python3 tests/route_contract_test.py --json                # Machine-readable
```

**Why it exists:** The #1 cause of "No Data" bugs was method/path mismatches between frontend and backend. TypeScript and Python linters cannot catch cross-language contract violations.

---

### 3. Schema Drift Detector (`schema_drift_test.py`)

Compares Pydantic model fields against database columns to catch validation mismatches before they cause 500 errors.

```bash
python3 tests/schema_drift_test.py                     # Offline self-audit
python3 tests/schema_drift_test.py --live              # Compare against live DB
python3 tests/schema_drift_test.py --update-snapshot   # Save DB schema locally
python3 tests/schema_drift_test.py --json              # Machine-readable
```

**Modes:**
- **Offline** (default): Runs heuristic checks on Pydantic models (strict constraints, nullable risks).
- **Snapshot**: Compares against a saved `schema_snapshot.json` file.
- **Live**: Fetches columns directly from Supabase (requires `.env.testing` credentials).

**Why it exists:** The Settings 500 error was caused by `check_frequency_minutes: ge=1` while the DB stored `0`. This detector flags such risks automatically.

---

### 4. API Smoke Test (`api_smoke_test.py`)

Hits live endpoints to verify they respond with expected status codes. Not part of the pre-push gate (requires network + deployed backend).

```bash
python3 tests/api_smoke_test.py --base-url https://hotel-delta-green.vercel.app
python3 tests/api_smoke_test.py --base-url http://localhost:8000
python3 tests/api_smoke_test.py --only dashboard settings  # Specific endpoints
```

**When to use:** After deploying to Vercel, or during CI to confirm runtime health.

---

## Configuration (`.audit.json`)

Shared config file used by `i18n_validator` and `route_contract_test`:

```json
{
  "base_url": "https://hotel-delta-green.vercel.app",
  "frontend_api": "lib/api.ts",
  "backend_api_dir": "backend/api/",
  "i18n_components": ["components/", "app/"],
  "i18n_dicts": ["dictionaries/en.ts", "dictionaries/tr.ts"],
  "i18n_function": "t"
}
```

---

## Typical Workflows

### Before Every Push (Automatic)
```
git push → pre-push hook → gate.py → 4 checks in ~150ms → pass/fail
```

### After Deployment (Manual)
```bash
python3 tests/api_smoke_test.py --base-url https://hotel-delta-green.vercel.app
```

### After Schema Changes (Manual)
```bash
python3 tests/schema_drift_test.py --live
python3 tests/schema_drift_test.py --update-snapshot  # Save new baseline
```

### Full Audit (Periodic)
```bash
python3 tests/gate.py && python3 tests/api_smoke_test.py --base-url https://hotel-delta-green.vercel.app
```
