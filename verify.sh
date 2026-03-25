#!/bin/bash
PROJECT_ROOT="/home/tripzydevops/hotel"
VIRTUAL_ENV="$PROJECT_ROOT/venv"

# Use the venv python to run the checklist
export PYTHONPATH="$PROJECT_ROOT:$PROJECT_ROOT/backend"
"$VIRTUAL_ENV/bin/python" "$PROJECT_ROOT/.agent/scripts/checklist.py" "$PROJECT_ROOT"
