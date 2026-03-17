# Vercel Deployment Attempt 4 - Zero Config
import os
import sys

# EXPLANATION: Path resolution for Vercel Serverless
# We must ensure the root directory is in sys.path so 'from backend.main import app' works.
# This ensures that even if Vercel invokes this from a suboptimal CWD, the imports succeed.
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(script_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.main import app
except ImportError as e:
    # If it still fails, we provide a diagnostic fallback
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    @app.get("/api/debug-path")
    async def debug_path():
        return {
            "error": str(e),
            "script_dir": script_dir,
            "root_dir": root_dir,
            "sys_path": sys.path,
            "cwd": os.getcwd(),
            "ls_root": os.listdir(root_dir) if os.path.exists(root_dir) else "ROOT_NOT_FOUND"
        }
