from fastapi import FastAPI
from fastapi.responses import JSONResponse
import datetime
import os
import sys

app = FastAPI()

@app.get("/api/ping")
async def ping():
    return {
        "status": "pong",
        "timestamp": datetime.datetime.now().isoformat(),
        "runtime": "python",
        "cwd": os.getcwd(),
        "sys_path": sys.path
    }

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def catch_all(path: str):
    return JSONResponse(
        content={
            "status": "minimal_bridge_active",
            "path": path,
            "message": "The minimal Python bridge is responding. The main backend is likely crashing during import."
        }
    )
