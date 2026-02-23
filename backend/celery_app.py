import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Use Redis as the broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# KAİZEN: Automatic SSL Parameter Injection
# Newer redis-py/kombu versions require ssl_cert_reqs in the URL for rediss://
# if not explicitly passed in connection options.
if REDIS_URL.startswith("rediss://") and "ssl_cert_reqs" not in REDIS_URL:
    sep = "&" if "?" in REDIS_URL else "?"
    REDIS_URL = f"{REDIS_URL}{sep}ssl_cert_reqs=none"

celery_app = Celery(
    "hotel_app",
    broker=REDIS_URL,
    backend=REDIS_URL,
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
