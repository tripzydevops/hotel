import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from backend.services.auth_service import get_insforge_admin

logger = logging.getLogger(__name__)

# B2B agent imports (formerly B2C persona_agent / recommendation_engine)
from backend.agents.persona_agent import build_compset_profile, CompsetProfileModel
from backend.services.recommendation_engine import update_compset_profile


async def process_pending_signals() -> None:
    """
    Background job — B2B Product Intelligence Signal Processor.

    Polls `user_signals` for the last hour of dashboard interactions,
    groups them by user, and builds a CompsetProfileModel for each
    revenue manager that has accumulated enough signals (≥ 5 events).

    The profile captures:
    - Which competitors they interact with most (attention weights)
    - Which competitors they routinely ignore (blind spots)
    - AI-generated strategic recommendation

    Results are written to `user_profiles.compset_weights` and logged to
    `agent_workflows` for observability.

    This job is designed to be called by:
    - A FastAPI BackgroundTask on the signals ingestion endpoint
    - A scheduled cron (e.g., every 30 minutes via GitHub Actions / Vercel cron)
    """
    db = get_insforge_admin()
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    try:
        # 1. Fetch unprocessed signals from the last hour
        response = (
            db.table("user_signals")
            .select("*")
            .gte("created_at", one_hour_ago)
            .execute()
        )

        signals = response.data or []
        if not signals:
            logger.info("Signal processor: no new signals to process.")
            return

        logger.info(f"Signal processor: found {len(signals)} signals to process.")

        # 2. Group signals by user_id (skip anonymous sessions)
        grouped_signals: Dict[str, List[Dict[str, Any]]] = {}
        for sig in signals:
            uid = sig.get("user_id")
            if not uid:
                continue  # anonymous signals tracked by session only — skip for now
            grouped_signals.setdefault(uid, []).append(sig)

        # 3. Process each user
        for user_id, user_sigs in grouped_signals.items():

            # Only process users with meaningful interaction volumes
            if len(user_sigs) < 5:
                logger.debug(
                    f"Skipping user {user_id}: only {len(user_sigs)} signals (threshold: 5)"
                )
                continue

            logger.info(
                f"Building compset profile for user {user_id} "
                f"from {len(user_sigs)} signals..."
            )

            # Log workflow start in agent_workflows table
            workflow_id = _log_workflow_start(db, user_id)

            try:
                # 4a. Infer competitor attention profile via Gemini
                profile: CompsetProfileModel = await build_compset_profile(user_sigs)

                # 4b. Persist compset profile to user_profiles
                await update_compset_profile(user_id, profile)

                # 4c. Mark workflow complete with reasoning trace
                _log_workflow_complete(
                    db,
                    workflow_id,
                    reasoning={
                        "primary_threat": profile.primary_threat,
                        "competitor_weights": profile.competitor_weights,
                        "blind_spots": profile.blind_spots,
                        "recommended_focus": profile.recommended_focus,
                        "reasoning_trace": profile.reasoning_trace,
                    },
                )

                logger.info(
                    f"Compset profile complete for user {user_id}: "
                    f"primary_threat={profile.primary_threat}"
                )

            except Exception as user_err:
                logger.error(
                    f"Failed to build compset profile for user {user_id}: {user_err}"
                )
                _log_workflow_failed(db, workflow_id, str(user_err))

    except Exception as e:
        logger.error(f"Signal processor: fatal error — {e}")


# ---------------------------------------------------------------------------
# agent_workflows Helpers (Observability)
# ---------------------------------------------------------------------------

def _log_workflow_start(db: Any, user_id: str) -> str | None:
    """
    Inserts a 'pending' agent_workflows row so we can track the job lifecycle.
    Returns the new workflow ID (or None if DB insert fails).
    """
    try:
        res = (
            db.table("agent_workflows")
            .insert(
                {
                    "agent_role": "CompsetIntelligenceAgent",
                    "status": "running",
                    "triggered_by": user_id,
                    "reasoning_trace": None,
                }
            )
            .execute()
        )
        return res.data[0]["id"] if res.data else None
    except Exception as e:
        logger.warning(f"Could not log workflow start: {e}")
        return None


def _log_workflow_complete(db: Any, workflow_id: str | None, reasoning: Dict) -> None:
    """Marks the agent_workflows row as 'complete' with reasoning trace."""
    if not workflow_id:
        return
    try:
        db.table("agent_workflows").update(
            {"status": "complete", "reasoning_trace": reasoning}
        ).eq("id", workflow_id).execute()
    except Exception as e:
        logger.warning(f"Could not log workflow completion: {e}")


def _log_workflow_failed(db: Any, workflow_id: str | None, error: str) -> None:
    """Marks the agent_workflows row as 'failed' with the error message."""
    if not workflow_id:
        return
    try:
        db.table("agent_workflows").update(
            {"status": "failed", "reasoning_trace": {"error": error}}
        ).eq("id", workflow_id).execute()
    except Exception as e:
        logger.warning(f"Could not log workflow failure: {e}")


if __name__ == "__main__":
    asyncio.run(process_pending_signals())
