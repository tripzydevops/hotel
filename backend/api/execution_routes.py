from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
from supabase import Client
from backend.utils.db import get_supabase_rls
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/execution", tags=["Execution Bridge"])

class ExecutionRequest(BaseModel):
    event_id: str
    action: str # 'accept_and_execute', 'reject'
    strategy: Dict[str, Any]

@router.post("/bridge")
async def execute_strategy_bridge(req: ExecutionRequest, db: Client = Depends(get_supabase_rls)):
    """
    [Future-Proofing] Webhook listener for AI-recommended actions.
    Prepares for 2-way sync with channel managers (e.g., HotelRunner).
    """
    logger.info(f"[ExecutionBridge] Strategy execution triggered for event {req.event_id}: {req.action}")
    
    if req.action == "reject":
        return {"status": "ignored", "message": "Strategy rejected by user."}

    # 1. Log Execution attempt
    # We would typically have a 'strategy_executions' table
    try:
        # Placeholder for real integration (Task 4.2)
        # In the future, this would call HotelRunner API or similar.
        logger.info(f"[ExecutionBridge] MOCK: Sending +{req.strategy.get('price_bump', 0)}% to Channel Manager.")
        
        return {
            "status": "success", 
            "message": "Strategy queued for execution.",
            "details": {
                "signal": req.event_id,
                "action": "Price adjustment sent to bridge."
            }
        }
    except Exception as e:
        logger.error(f"[ExecutionBridge] Execution failed: {e}")
        raise HTTPException(status_code=500, detail="Bridge connectivity issue.")
