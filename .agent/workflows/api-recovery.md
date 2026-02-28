---
description: How to quickly recover from 404/405 errors on Vercel
---

# Vercel API Recovery Workflow (Fast Fix)

If the dashboard shows "API Error" or you see 404/405 errors in the browser console after a deployment, follow these steps to restore the FastAPI bridge.

### 1. Restore the API Entry Point
Ensure `api/index.py` is not empty and correctly exports the FastAPI instance.

```python
# Location: api/index.py
from backend.main import app # MUST BE PRESENT
```

### 2. Verify Package Initialization
The Vercel Python runtime requires all backend directories to be valid packages. Ensure `__init__.py` exists in every subfolder.

```bash
# Run this to ensure all required init files are present
touch backend/__init__.py backend/api/__init__.py backend/services/__init__.py backend/utils/__init__.py
```

### 3. Check Vercel Routing Configuration
Verify `vercel.json` has the correct rewrite rule for the `/api` prefix.

```json
{
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/index.py"
    }
  ]
}
```

### 4. Deploy and Verify
Push the changes and monitor the Vercel logs via the CLI or Dashboard.

```bash
git add api/index.py backend/
git commit -m "fix: restore api bridge"
git push origin main
```

// turbo
### 5. Check Live Logs (Optional)
```bash
vercel logs project-name --limit 50
```
