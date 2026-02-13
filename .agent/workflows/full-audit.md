---
description: Full frontend-backend integration audit — catches route mismatches, i18n gaps, and runtime errors
---

# Full Audit Workflow

Run this workflow whenever asked to verify that all features work correctly.
Do NOT skip steps. Each step catches a different category of bug.

## Phase 1: Static Checks (< 1 min)

1. **TypeScript compilation**
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && npx tsc --noEmit 2>&1 | head -30
```

2. **Lint check**
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && npm run lint 2>&1 | tail -10
```

3. **Backend import test**
// turbo
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && python3 -c "from backend.main import app; print('✅ Backend OK')"
```

## Phase 2: Contract Validation (< 30 sec)

4. **Route contract test** — catches method/path mismatches between frontend and backend
// turbo
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && python3 tests/route_contract_test.py
```

5. **i18n key validator** — catches missing translation keys
// turbo
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && python3 tests/i18n_validator.py
```

## Phase 3: Runtime Smoke Test (requires auth token)

6. **API smoke test** — If a Supabase token is available, test all endpoints:
```bash
cd /home/successofmentors/.gemini/antigravity/scratch/hotel && python3 tests/api_smoke_test.py
```
> Skip this step if no auth token is available. Note the skip in the audit report.

## Phase 4: Browser Verification (if browser available)

7. **Load each page** — Use the browser tool to visit:
   - `/login` — verify login form renders
   - `/dashboard` — verify hotel cards and KPIs load (requires auth)
   - `/analysis` — verify tabs display labels (not raw keys)
   - `/reports` — verify report history loads
   - `/admin` — verify admin panel loads

8. **Screenshot evidence** — Take screenshots of any pages that show errors, "N/A", or "No Data".

## Phase 5: Reporting

9. **Summarize results** — Report to the user with:
   - Number of tests passed / failed per phase
   - Screenshots of any failures
   - Specific files and line numbers that need fixing

10. **Update task.md** — Mark audit items as complete or flag issues.

---

## Notes

- Phases 1-2 are **mandatory** and catch 80% of integration bugs.
- Phases 3-4 require auth credentials or a running dev server.
- Phase 5 ensures findings are documented.
- NEVER report "all checks pass" if you only ran Phase 1.
