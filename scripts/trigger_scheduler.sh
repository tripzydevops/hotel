#!/bin/bash
# Description: Triggers the internal scheduler via the background cron API.
# Frequency: Should be run every minute via system cron.

# EXPLANATION: Persistent Trigger Mechanism
# This script hits the internal /api/cron endpoint to wake up the 
# scheduler logic. This replaces the 'lazy cron' which only fired 
# when users were active on the site.

# Trigger the script directly using the virtual environment
# This is more robust than hitting the API as it doesn't depend on the web server.
cd /home/successofmentors/.gemini/antigravity/scratch/hotel
export PYTHONPATH=$PYTHONPATH:.
./venv/bin/python3 backend/scripts/run_scheduler.py > /dev/null 2>&1

# Log execution attempt for infrastructure auditing
echo "$(date): Triggered scheduler script" >> /home/successofmentors/.gemini/antigravity/scratch/hotel/cron_trigger.log
