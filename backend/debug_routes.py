
from fastapi import APIRouter, Depends
from backend.main import get_current_active_user, app

@app.get("/api/debug-auth")
async def debug_auth(user = Depends(get_current_active_user)):
    return {"status": "ok", "user": user.id}
