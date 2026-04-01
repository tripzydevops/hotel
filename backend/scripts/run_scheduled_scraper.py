import asyncio
import os
import sys
import argparse
from backend.utils.db import load_env_standard

# EXPLANATION: Setup PYTHONPATH for backend discovery
# Ensures the script can find the "backend" module when run from the root.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment after setting path to ensure .env is found
load_env_standard()

from backend.scraper.rate_scraper import RateScraper
from backend.utils.logger import get_logger

logger = get_logger("scheduled_scraper")

async def main():
    parser = argparse.ArgumentParser(description="Run scheduled hotel rate scans.")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of users to process in this run.")
    args = parser.parse_args()

    scraper = RateScraper()
    logger.info(f"Starting scheduled scraper run (batch_size={args.batch_size})...")
    
    try:
        await scraper.run_scheduled_scans(batch_size=args.batch_size)
    except Exception as e:
        logger.critical(f"FATAL: Scheduled scraper failed: {e}")
        sys.exit(1)
        
    logger.info("Scheduled scraper run complete.")

if __name__ == "__main__":
    asyncio.run(main())
