from fastapi import APIRouter, Request, Response
from backend.utils.logger import get_logger

# Initialize router without prefix here, prefix will be added in main.app
router = APIRouter(tags=["webhooks"])
logger = get_logger(__name__)

@router.post("/hotel-webhook")
async def hotel_webhook_handler(request: Request):
    """
    Serverless API route for hotel webhooks.
    Parses incoming JSON, logs it, and returns 200 OK.
    No database or external logic included as requested.
    """
    try:
        # Parse the incoming JSON body
        payload = await request.json()
        
        # Print the entire payload to server logs
        print("--- HOTEL WEBHOOK PAYLOAD START ---")
        print(payload)
        print("--- HOTEL WEBHOOK PAYLOAD END ---")
        
        # Log via configured logger as well
        logger.info(f"Received hotel webhook payload: {payload}")
        
        return {"status": "success", "message": "Webhook received"}
        
    except Exception as e:
        # If parsing fails or any other error occurs
        print(f"ERROR: Failed to process hotel webhook: {str(e)}")
        logger.error(f"Hotel webhook error: {str(e)}")
        # Still return a response but could be 400 if strictly JSON is expected
        # For simplicity and to ensure "immediately return 200" we return 200 or handle error
        return {"status": "error", "message": str(e)}
