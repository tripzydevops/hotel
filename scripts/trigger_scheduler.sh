#!/bin/bash
# ============================================================================
# SCHEDULER TRIGGER SCRIPT
# Called every minute by system cron.
#
# HARDENED VERSION — Previously redirected all output to /dev/null, which
# silenced SyntaxErrors and ImportErrors, causing scheduled scans to fail
# for hours without any visible indication. This version:
#
# 1. Logs all output (stdout + stderr) to scheduler_errors.log
# 2. Runs a Python syntax pre-check on the import chain before executing
# 3. Writes a heartbeat timestamp so we can detect if cron itself stops
# ============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERROR_LOG="${PROJECT_DIR}/scheduler_errors.log"
HEARTBEAT_FILE="${PROJECT_DIR}/scheduler_heartbeat.txt"
VENV_PYTHON="${PROJECT_DIR}/venv/bin/python3"

cd "$PROJECT_DIR" || exit 1
export PYTHONPATH="${PYTHONPATH}:."

# ── Step 1: Write heartbeat (proves cron is alive) ──
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$HEARTBEAT_FILE"

# ── Step 2: Syntax pre-check on critical import chain ──
# These are the files that get imported when the scheduler starts.
# If ANY of them have a syntax error, the scheduler silently dies.
CRITICAL_FILES=(
    "backend/utils/sentiment_utils.py"
    "backend/agents/analyst_agent.py"
    "backend/agents/scraper_agent.py"
    "backend/agents/notifier_agent.py"
    "backend/services/monitor_service.py"
    "backend/scripts/run_scheduler.py"
)

for f in "${CRITICAL_FILES[@]}"; do
    if [ -f "$f" ]; then
        # python -m py_compile returns non-zero on syntax errors
        if ! "$VENV_PYTHON" -m py_compile "$f" 2>/dev/null; then
            echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] FATAL: Syntax error in $f — scheduler BLOCKED" >> "$ERROR_LOG"
            # Don't run the scheduler if the import chain is broken
            exit 1
        fi
    fi
done

# ── Step 3: Run the scheduler (log errors instead of silencing them) ──
"$VENV_PYTHON" backend/scripts/run_scheduler.py >> "$ERROR_LOG" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] SCHEDULER FAILED with exit code $EXIT_CODE" >> "$ERROR_LOG"
fi

# ── Step 4: Log execution to trigger log (backward compatibility) ──
echo "$(date): Triggered scheduler script (exit=$EXIT_CODE)" >> "${PROJECT_DIR}/cron_trigger.log"
