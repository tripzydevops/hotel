import uuid
from fastapi import HTTPException
from backend.utils.logger import get_logger

logger = get_logger(__name__)

def raise_masked_error(
    e: Exception, 
    status_code: int = 500, 
    message: str = "Internal server error",
    context: str = "General"
):
    """
    Masks a raw exception with a generic user-facing message and a unique reference ID.
    Logs the full traceback internally for administrative debugging.
    """
    ref_id = str(uuid.uuid4())[:8]
    logger.error(f"[{context}] [{ref_id}] {str(e)}", exc_info=True)
    
    raise HTTPException(
        status_code=status_code,
        detail=f"{message} (Reference: {ref_id})"
    )
