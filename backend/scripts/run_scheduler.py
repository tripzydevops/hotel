
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure backend module is resolvable
path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if path not in sys.path:
    sys.path.append(path)

from backend.services.monitor_service import run_scheduler_check_logic

if __name__ == "__main__":
    print("Starting manual scheduler trigger...")
    asyncio.run(run_scheduler_check_logic())
    print("Manual scheduler trigger complete.")
