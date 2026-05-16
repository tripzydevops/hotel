#!/bin/bash
cd "$(dirname "$0")/.."
# Use the local virtual environment explicitly
./.venv/bin/python backend/scripts/run_scheduler.py

