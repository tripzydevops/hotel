from typing import Dict, Any
from backend.services.notification_service import notification_service


class NotifierAgent:
    """
    Agent responsible for multi-channel communication (Email, WhatsApp, Push).
    2026 Strategy: Decoupled for asynchronous delivery and retries.
    """

    def __init__(self, db=None):
        from backend.utils.db import get_supabase

        self.db = db or get_supabase()
        self._log_buffer = []

    async def log_reasoning(self, session_id, message: str):
        """Append a message to the internal buffer instead of immediate DB write."""
        if not session_id:
            return
        self._log_buffer.append(f"[Notifier] {message}")

    async def flush_logs(self, session_id):
        """Perform a single batch update to persist all buffered reasoning traces."""
        if not session_id or not self._log_buffer:
            return
        try:
            # Atomic fetch-modify-update
            res = (
                self.db.table("scan_sessions")
                .select("reasoning_trace")
                .eq("id", str(session_id))
                .execute()
            )
            trace = res.data[0]["reasoning_trace"] if res.data else []
            trace.extend(self._log_buffer)
            self.db.table("scan_sessions").update({"reasoning_trace": trace}).eq(
                "id", str(session_id)
            ).execute()
            self._log_buffer = []  # Clear after flush
        except Exception as e:
            print(f"[NotifierAgent] Failed to flush logs: {e}")

    async def dispatch_alerts(
        self,
        alerts: list,
        settings: Dict[str, Any],
        hotel_name_map: Dict[str, str],
        session_id=None,
    ):
        """Sends alerts through configured channels, batching if multiple alerts exist."""
        if not alerts:
            if session_id:
                await self.log_reasoning(
                    session_id,
                    "No threshold breaches detected. Skipping notifications.",
                )
                await self.flush_logs(session_id)
            return

        if len(alerts) > 1:
            await self.log_reasoning(
                session_id, f"Aggregating {len(alerts)} alerts into a summary..."
            )
            try:
                await notification_service.send_summary_notifications(
                    settings=settings, alerts=alerts, hotel_name_map=hotel_name_map
                )
                await self.log_reasoning(
                    session_id, "Summary notification dispatched successfully."
                )
            except Exception as e:
                print(f"[NotifierAgent] Failed to dispatch summary: {e}")
                await self.log_reasoning(session_id, f"Dispatch FAILED: {str(e)}")
        else:
            # Single alert behavior
            alert = alerts[0]
            hotel_id = alert["hotel_id"]
            hotel_name = hotel_name_map.get(hotel_id, "Unknown Hotel")
            await self.log_reasoning(
                session_id, f"Dispatching alert for {hotel_name}..."
            )

            try:
                await notification_service.send_notifications(
                    settings=settings,
                    hotel_name=hotel_name,
                    alert_message=alert["message"],
                    current_price=alert["new_price"],
                    previous_price=alert["old_price"],
                    currency=alert.get("currency", "USD"),
                )
                await self.log_reasoning(
                    session_id, f"Alert for {hotel_name} dispatched."
                )
            except Exception as e:
                print(f"[NotifierAgent] Failed to dispatch alert: {e}")
                await self.log_reasoning(session_id, f"Dispatch FAILED: {str(e)}")

        # Final flush to persist all reasoning traces in one DB operation
        if session_id:
            await self.flush_logs(session_id)
