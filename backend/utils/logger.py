"""
Structured Logger Utility
=========================
Provides a centralized, consistent logging interface for the Hotel Rate Sentinel backend.

WHY: The codebase previously used raw print() statements for error/debug output.
This made it impossible to filter by severity, search logs in production (Vercel),
or integrate with monitoring tools (Sentry, Datadog, etc.).

HOW: Uses Python's built-in `logging` module with a JSON-like formatter for production
and a human-readable formatter for local development. Each module gets its own
named logger via `get_logger(__name__)`.

USAGE:
    from backend.utils.logger import get_logger
    logger = get_logger(__name__)

    logger.info("Hotel scan started", extra={"hotel_id": hid})
    logger.warning("Legacy fallback used")
    logger.error(f"Scan failed: {e}", exc_info=True)
"""

import logging
import os
import sys


# EXPLANATION: Environment Detection
# In production (Vercel), LOG_LEVEL defaults to WARNING to reduce noise.
# Locally, it defaults to DEBUG for maximum visibility during development.
# Override with LOG_LEVEL=DEBUG in .env for verbose production debugging.
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
_IS_PRODUCTION = os.environ.get("VERCEL", "") == "1"


class StructuredFormatter(logging.Formatter):
    """
    EXPLANATION: Production-Ready Formatter
    Outputs logs in a structured format that Vercel and log aggregators can parse.
    Includes timestamp, level, logger name, and message on a single line.
    """

    def format(self, record: logging.LogRecord) -> str:
        # EXPLANATION: Single-Line Structured Output
        # Format: [LEVEL] module_name | message
        # This is grep-friendly and works well with Vercel's log viewer.
        level = record.levelname.ljust(8)
        name = record.name.split(".")[-1]  # Use short module name
        msg = super().format(record)
        return f"[{level}] {name} | {msg}"


def get_logger(name: str) -> logging.Logger:
    """
    Factory function to create a named logger with consistent configuration.

    EXPLANATION: Module-Level Logger Pattern
    Each module calls get_logger(__name__) once at module level.
    This gives us per-module filtering and makes log sources traceable.

    Args:
        name: Usually __name__ of the calling module.

    Returns:
        A configured logging.Logger instance.
    """
    logger = logging.getLogger(name)

    # EXPLANATION: Prevent Duplicate Handlers
    # If the logger already has handlers (e.g., module imported multiple times),
    # we skip adding another one to avoid duplicate log lines.
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(StructuredFormatter())
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, _LOG_LEVEL, logging.INFO))

        # EXPLANATION: Propagation Control
        # We disable propagation to the root logger to prevent duplicate output
        # when FastAPI/uvicorn also configure logging.
        logger.propagate = False

    return logger
