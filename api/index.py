from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import httpx
import os

app = FastAPI()

# KAİZEN: Dynamic proxying for InsForge/Vercel support
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

@app.get("/p-api/api/health")
async def health():
    return {"status": "ok", "message": "final_test"}

@app.get("/api/health")
async def legacy_health():
    return {"status": "ok", "mode": "legacy"}

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(request: Request, path: str):
    url = f"{BACKEND_URL}/{path}"
    async with httpx.AsyncClient() as client:
        try:
            body = await request.body()
            resp = await client.request(
                method=request.method,
                url=url,
                content=body,
                headers=dict(request.headers),
                params=dict(request.query_params)
            )
            return JSONResponse(
                status_code=resp.status_code,
                content=resp.json() if resp.headers.get("content-type") == "application/json" else resp.text
            )
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})
