
from typing import Dict, Any
from backend.services.notification_service import notification_service

class NotifierAgent:
    """
    Agent responsible for multi-channel communication (Email, WhatsApp, Push).
    2026 Strategy: Decoupled for asynchronous delivery and retries.
    """
    def __init__(self):
        pass

    async def dispatch_alerts(self, alerts: list, settings: Dict[str, Any], hotel_name_map: Dict[str, str]):
        """Sends alerts through configured channels, batching if multiple alerts exist."""
        if not alerts:
            return

        if len(alerts) > 1:
            # EXPLANATION: Notification Batching (Kaizen Pillar 4)
            # User reported 6-7 notifications during scans which crashed the experience.
            # We now aggregate multiple alerts into a single summary notification.
            try:
                await notification_service.send_summary_notifications(
                    settings=settings,
                    alerts=alerts,
                    hotel_name_map=hotel_name_map
                )
            except Exception as e:
                print(f"[NotifierAgent] Failed to dispatch summary: {e}")
        else:
            # Single alert behavior (legacy support)
            alert = alerts[0]
            hotel_id = alert["hotel_id"]
            hotel_name = hotel_name_map.get(hotel_id, "Unknown Hotel")
            
            try:
                await notification_service.send_notifications(
                    settings=settings,
                    hotel_name=hotel_name,
                    alert_message=alert["message"],
                    current_price=alert["new_price"],
                    previous_price=alert["old_price"],
                    currency=alert.get("currency", "USD")
                )
            except Exception as e:
                print(f"[NotifierAgent] Failed to dispatch alert: {e}")
