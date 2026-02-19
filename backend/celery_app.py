import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Use Redis as the broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "hotel_app",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Optional: Rate limit if needed
    # task_default_rate_limit="10/m" 
)
