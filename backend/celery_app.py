import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# EXPLANATION: Redis/Celery Decommissioned (2026-02-25)
# We have transition to FastAPI BackgroundTasks to avoid Upstash command limits.
# Redis is no longer required for scans.
REDIS_URL = "memory://"
RESULT_BACKEND = "rpc://"

celery_app = Celery(
    "hotel_app",
    broker=REDIS_URL,
    backend=RESULT_BACKEND,
    include=["backend.tasks"]
)

import ssl

config = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "worker_concurrency": 2,
}

if REDIS_URL.startswith("rediss://"):
    config.update({
        "broker_use_ssl": {
            "ssl_cert_reqs": ssl.CERT_NONE
        },
        "redis_backend_use_ssl": {
            "ssl_cert_reqs": ssl.CERT_NONE
        }
    })

celery_app.conf.update(**config)
