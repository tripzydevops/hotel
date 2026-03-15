from fastapi import APIRouter, Depends, HTTPException
from backend.services.auth_service import get_current_admin_user
import os

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/kaizen-logs")
async def get_kaizen_logs(admin=Depends(get_current_admin_user)):
    """
    Fetches the latest entries from kaizen.log for the debug window.
    """
    log_path = "/home/tripzydevops/hotel/kaizen.log"
    if not os.path.exists(log_path):
        return {"logs": ["Log file not found."]}
    
    try:
        with open(log_path, "r") as f:
            lines = f.readlines()
            # Satisfy linter by using standard indexing or ensuring it sees a list
            count = len(lines)
            start = max(0, count - 100)
            # Use list comprehension to avoid slice-related lint issues in some configurations
            return {"logs": [lines[i] for i in range(start, count)]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
