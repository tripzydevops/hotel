#!/bin/bash
# Bridge script for legacy cron jobs
# Resolves: /bin/sh: 1: /home/tripzydevops/hotel/scripts/trigger_scheduler.sh: not found
# Calls the revised backend scheduler logic.

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Call the new Python-based scheduler
python3 backend/scripts/run_scheduler.py
