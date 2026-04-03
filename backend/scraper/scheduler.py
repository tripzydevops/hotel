import os
import sys
import subprocess
import time
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('HotelScheduler')

def run_pricing_service():
    """
    Runs the pricing service using the correct Python path.
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Ensure current backend is in PYTHONPATH
    env = os.environ.copy()
    if 'PYTHONPATH' in env:
        env['PYTHONPATH'] = f"{backend_dir}:{env['PYTHONPATH']}"
    else:
        env['PYTHONPATH'] = backend_dir

    logger.info("Starting Pricing DNA processing...")
    try:
        # Run the pricing_dna module directly
        subprocess.run(
            [sys.executable, "-m", "services.pricing_dna"],
            cwd=backend_dir,
            env=env,
            check=True
        )
        logger.info("Pricing DNA processing completed successfully.")
    except Exception as e:
        logger.error(f"Error running Pricing DNA: {e}")

def main():
    logger.info("Hotel Scheduler started. Frequency: 1 hour.")
    while True:
        run_pricing_service()
        # Sleep for 1 hour (3600 seconds)
        time.sleep(3600)

if __name__ == "__main__":
    main()
