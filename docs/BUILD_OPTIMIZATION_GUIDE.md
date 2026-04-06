# Build Optimization & Redundancy Removal Guide

This document outlines the redundancies identified in the `hotel` project that contribute to slow Vercel builds and local development overhead. Use this guide to streamline the repository when ready for maintenance.

## 1. Redundancies Identified

### Virtual Environments (Duplicate Bloat)
The project currently contains two large Python virtual environments:
- `venv/` (~516MB)
- `.venv/` (~521MB)

**Recommendation**: Standardize on `.venv/` and remove `venv/`. While these are ignored by Vercel, they slow down local IDE indexing, `grep` searches, and git operations if not handled carefully.

### Legacy Vercel Configuration
The `vercel.json` file uses a legacy `"builds"` array. Modern Vercel projects (Next.js 15+) automatically detect the appropriate builders.
- **Problem**: Explicit `builds` can occasionally trigger redundant or non-optimized build pipelines.
- **Recommendation**: Transition to "Zero Config" mode by removing the `builds` object from `vercel.json`.

### Obsolete Root Scripts & Logs
Approximately 15-20% of the files in the root directory are one-off diagnostic scripts or unrotated logs:
- **Logs**: `backend.log`, `cron_trigger.log*`, `scheduler.log.1`, etc.
- **Obsolete Scripts**: `verify_apis.py`, `check_api_status.py`, `test_log_suffix.py`, etc.

---

## 2. Implementation Checklist

### Step 1: Purge Redundant Environments
Run the following from the root directory:
```bash
rm -rf venv/
```

### Step 2: Modernize Vercel Configuration
Update [vercel.json](file:///home/tripzydevops/hotel/vercel.json) by removing the `"builds"` section:

```diff
-{
-  "version": 2,
-  "builds": [
-    {
-      "src": "api/index.py",
-      "use": "@vercel/python"
-    },
-    {
-      "src": "package.json",
-      "use": "@vercel/next"
-    }
-  ],
+ {
+  "version": 2,
   "rewrites": [ ... ],
   "headers": [ ... ]
 }
```

### Step 3: Script & Log Cleanup
Remove diagnostic tools that are no longer needed in the main branch:
```bash
rm backend.log cron_trigger.log* scheduler.log*
rm verify_*.py test_*.py check_*.py diag_*.py
rm verify.sh
```

### Step 4: Correct Dependency Placement
In [package.json](file:///home/tripzydevops/hotel/package.json), move `@supabase/supabase-js` to `dependencies`:
```bash
# Example command using npm
npm install @supabase/supabase-js
```

---

## 3. Prevention & Best Practices

1. **Maintain `.vercelignore`**: Ensure that any new large local directories (like caches or data dumps) are immediately added to `.vercelignore` to keep the Vercel upload context small.
2. **Unified Python Entry**: Manage all Python dependencies through a single `requirements.txt` or `pyproject.toml` to avoid confusion between different venv setups.
3. **Log Rotation**: In the Python backend, implement a rotating file handler to prevent `backend.log` from growing indefinitely.
