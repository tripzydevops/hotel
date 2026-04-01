import asyncio
import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

# Ensure backend module is resolvable
path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if path not in sys.path:
    sys.path.append(path)

from backend.scraper.rate_scraper import RateScraper

async def main():
    parser = argparse.ArgumentParser(description="Run scheduled hotel rate scraper")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of users to process per run")
    args = parser.parse_args()

    print(f"Starting scheduled scraper (batch_size={args.batch_size})...")

    scraper = RateScraper()
    await scraper.run_scheduled_scans(batch_size=args.batch_size)

    print("Scheduled scraper run complete.")

if __name__ == "__main__":
    asyncio.run(main())
