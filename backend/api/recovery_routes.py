from fastapi import APIRouter, Depends, HTTPException, Request
from backend.utils.limiter import limiter
from backend.utils.errors import raise_masked_error
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from backend.services.auth_service import get_supabase_rls
from backend.services.recovery_service import generate_dispute_letter
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/recovery", tags=["Revenue Recovery"])

class DisputeRequest(BaseModel):
    hotel_id: str
    ota_name: str
    current_price: float
    target_price: float
    currency: str
    language: Optional[str] = "tr"

@router.post("/generate-dispute")
@limiter.limit("5/minute")
async def api_generate_dispute(
    req: DisputeRequest,
    request: Request,
    db: Client = Depends(get_supabase_rls)
):
    """
    Generates an AI-powered dispute letter for a parity violation.
    """
    try:
        # Fetch hotel name for context
        hotel_res = db.table("hotels").select("name").eq("id", req.hotel_id).single().execute()
        hotel_name = hotel_res.data.get("name") if hotel_res.data else "Your Hotel"
        
        letter = await generate_dispute_letter(
            hotel_name=hotel_name,
            ota_name=req.ota_name,
            current_price=req.current_price,
            target_price=req.target_price,
            currency=req.currency,
            language=req.language
        )
        
        return {"letter": letter}
    except Exception as e:
        raise_masked_error(e, message="Failed to generate dispute letter", context="RecoveryGenerateDispute")
