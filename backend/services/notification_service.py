"""
Notification Service
Handles sending email notifications for alerts.
"""

import os
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Environment is loaded centrally via db.load_env_standard()
# No redundant load_dotenv() call needed here.


class NotificationService:
    """Service for sending notifications."""

    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.sender_email = os.getenv("SENDER_EMAIL", self.smtp_user)
        self.enabled = bool(self.smtp_user and self.smtp_password)

    def _write_to_mock_inbox(self, to_email: str, subject: str, body_html: str) -> None:
        """
        Writes the simulated HTML email to a local mock_email_inbox.md file in the docs/ directory.
        Allows developers and administrators to instantly inspect generated emails during local testing.
        """
        import os
        from datetime import datetime, timezone

        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            inbox_path = os.path.join(base_dir, "docs", "mock_email_inbox.md")

            # Create docs directory if it doesn't exist
            os.makedirs(os.path.dirname(inbox_path), exist_ok=True)

            timestamp = datetime.now(timezone.utc).isoformat()

            entry = f"""
---
### 📧 [MOCK EMAIL] Sent at: {timestamp}
* **To:** `{to_email}`
* **From:** `noreply@hotelplus.com`
* **Subject:** **{subject}**

#### Rendered Content:
```html
{body_html.strip()}
```
"""
            # Append to file
            mode = "a" if os.path.exists(inbox_path) else "w"
            with open(inbox_path, mode, encoding="utf-8") as f:
                f.write(entry)

            logger.info(f"[Notification] Simulated email appended to mock inbox: docs/mock_email_inbox.md")
        except Exception as e:
            logger.error(f"[Notification] Failed to write to mock inbox: {e}")

    def _send_smtp_email(self, msg: MIMEMultipart) -> bool:
        """
        Synchronous helper to send email via SMTP.
        Should be called via asyncio.to_thread to avoid blocking.
        """
        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"[Notification] SMTP Error: {e}")
            return False

    async def send_notifications(
        self,
        settings: dict,
        hotel_name: str,
        alert_message: str,
        current_price: float,
        previous_price: float,
        currency: str = "USD",
    ) -> dict:
        """
        Send notifications via all enabled channels.
        """
        results = {"email": False, "whatsapp": False, "push": False}

        # Global kill switch
        if not settings.get("notifications_enabled"):
            return results

        # 1. Email
        if settings.get("notification_email"):
            results["email"] = await self.send_alert_email(
                settings["notification_email"],
                hotel_name,
                alert_message,
                current_price,
                previous_price,
                currency,
            )

        # 2. WhatsApp (Placeholder)
        if settings.get("whatsapp_number"):
            results["whatsapp"] = await self.send_whatsapp(
                settings["whatsapp_number"], alert_message
            )

        # 3. Push (Desktop Notifications via Web Push API)
        if settings.get("push_enabled") and settings.get("push_subscription"):
            results["push"] = await self.send_push(
                settings.get("user_id"),
                alert_message,
                subscription=settings.get("push_subscription"),
                hotel_name=hotel_name,
            )

        return results

    async def send_summary_notifications(
        self, settings: dict, alerts: list, hotel_name_map: dict
    ) -> dict:
        """
        Consolidates multiple alerts into a single summary notification per channel.
        This prevents 'notification spam' during large scans.
        """
        results = {"email": False, "whatsapp": False, "push": False}

        if not settings.get("notifications_enabled") or not alerts:
            return results

        # Build summary message
        count = len(alerts)
        summary_lines = []
        for alert in alerts[:5]:  # Show first 5 in detail
            hname = hotel_name_map.get(alert["hotel_id"], "Unknown Hotel")
            summary_lines.append(f"• {hname}: {alert['message']}")

        if count > 5:
            summary_lines.append(f"... and {count - 5} more alerts.")

        full_summary = "\n".join(summary_lines)
        push_title = f"Hotel Plus: {count} Price Alerts Found"

        # 1. Email Summary
        if settings.get("notification_email"):
            results["email"] = await self.send_summary_email(
                settings["notification_email"], alerts, hotel_name_map
            )

        # 2. Push Summary
        if settings.get("push_enabled") and settings.get("push_subscription"):
            results["push"] = await self.send_push(
                settings.get("user_id"),
                full_summary,
                subscription=settings.get("push_subscription"),
                hotel_name=push_title,  # Use title as hotel_name for send_push logic
            )

        return results

    async def send_summary_email(
        self, to_email: str, alerts: list, hotel_name_map: dict
    ) -> bool:
        """Sends a batched email report for multiple alerts."""
        rows = ""
        for a in alerts:
            hname = hotel_name_map.get(a["hotel_id"], "Hotel")
            rows += f"<tr><td>{hname}</td><td>{a['old_price']}</td><td>{a['new_price']}</td><td>{a['message']}</td></tr>"

        body = f"""
        <html>
          <body>
            <h2>Price Alert Summary</h2>
            <p>Multiple price changes were detected during your last scan:</p>
            <table border="1" cellpadding="5" style="border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f2f2f2;">
                  <th>Hotel</th><th>Old Price</th><th>New Price</th><th>Details</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
            <p><a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}">Open Dashboard</a></p>
          </body>
        </html>
        """

        if not self.enabled:
            logger.info(f"[Notification] Email disabled. Simulating summary email to {to_email}")
            self._write_to_mock_inbox(to_email, f"Price Alert Summary: {len(alerts)} updates found", body)
            return True

        try:
            msg = MIMEMultipart()
            msg["From"] = self.sender_email
            msg["To"] = to_email
            msg["Subject"] = f"Price Alert Summary: {len(alerts)} updates found"
            msg.attach(MIMEText(body, "html"))

            # Offload to thread to prevent blocking the event loop
            return await asyncio.to_thread(self._send_smtp_email, msg)
        except Exception as e:
            logger.error(f"[Notification] Summary Email preparation failed: {e}")
            return False

    async def send_whatsapp(self, number: str, message: str) -> bool:
        """Placeholder for WhatsApp integration (e.g. Twilio)"""
        # TODO: Implement Twilio/Meta API
        logger.info(f"[Notification] WOULD send WhatsApp to {number}: {message}")
        return True

    async def send_push(
        self,
        user_id: str,
        message: str,
        subscription: dict = None,
        hotel_name: str = "",
    ) -> bool:
        """
        Send Web Push notification.
        """
        if not subscription:
            logger.warning(f"[Notification] No subscription found for user {user_id}")
            return False

        try:
            import json

            from pywebpush import webpush

            # Get VAPID private key from env
            private_key = os.getenv("VAPID_PRIVATE_KEY")
            if not private_key:
                logger.error("[Notification] VAPID_PRIVATE_KEY not set")
                return False

            claims = {
                "sub": os.getenv("VAPID_SUBJECT", "mailto:admin@rate-sentinel.com")
            }

            # JSON Payload for sw.js Compatibility
            payload = json.dumps(
                {
                    "title": f"Price Alert: {hotel_name}"
                    if hotel_name
                    else "Hotel Plus Alert",
                    "body": message,
                }
            )

            # Webpush is IO-bound (network call) — offload to thread
            # to prevent blocking the FastAPI event loop.
            await asyncio.to_thread(
                webpush,
                subscription_info=subscription,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims=claims,
            )
            logger.info(f"[Notification] Push sent to {user_id}")
            return True

        except ImportError:
            logger.error("[Notification] pywebpush not installed")
            return False
        except Exception as e:
            logger.error(f"[Notification] Push failed: {e}")
            return False

    async def send_alert_email(
        self,
        to_email: str,
        hotel_name: str,
        alert_message: str,
        current_price: float,
        previous_price: float,
        currency: str = "USD",
    ) -> bool:
        """
        Send an alert email to the user.
        """
        body = f"""
        <html>
          <body>
            <h2>Price Change Alert for {hotel_name}</h2>
            <p>{alert_message}</p>
            <ul>
              <li><strong>Current Price:</strong> {currency} {current_price}</li>
              <li><strong>Previous Price:</strong> {currency} {previous_price}</li>
            </ul>
            <p><a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}">View Dashboard</a></p>
          </body>
        </html>
        """

        if not self.enabled:
            logger.info(f"[Notification] Email disabled. Simulating email to {to_email}: {alert_message}")
            self._write_to_mock_inbox(to_email, f"Price Alert: {hotel_name}", body)
            return True

        try:
            msg = MIMEMultipart()
            msg["From"] = self.sender_email
            msg["To"] = to_email
            msg["Subject"] = f"Price Alert: {hotel_name}"
            msg.attach(MIMEText(body, "html"))

            # Offload to thread to prevent blocking the event loop
            return await asyncio.to_thread(self._send_smtp_email, msg)

        except Exception as e:
            logger.error(f"[Notification] Email preparation failed: {e}")
            return False

    async def send_mfa_code_email(self, to_email: str, code: str) -> bool:
        """
        Sends the 6-digit MFA security verification code email.
        """
        body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #0b132b; color: #ffffff; padding: 30px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #1c2541; padding: 40px; border-radius: 20px; border: 1px solid #c5a880; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <h2 style="color: #c5a880; text-align: center; font-style: italic; font-weight: 900; margin-top: 0;">HotelPlus Security</h2>
              <hr style="border-color: rgba(197, 168, 128, 0.2); margin: 20px 0;">
              <p style="font-size: 14px; line-height: 1.6; color: #a5b4fc;">
                A multi-factor authentication (MFA) challenge was requested for your administrative account. Please use the following 6-digit verification code to complete your secure login:
              </p>
              <div style="background-color: rgba(197, 168, 128, 0.1); border: 1px solid rgba(197, 168, 128, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #c5a880; font-family: monospace;">{code}</span>
              </div>
              <p style="font-size: 11px; color: #64748b; line-height: 1.6; text-align: center; margin-bottom: 0;">
                This code is valid for 10 minutes. If you did not request this code, please secure your credentials immediately.
              </p>
            </div>
          </body>
        </html>
        """

        if not self.enabled:
            logger.info(f"[Notification] Email disabled. Simulating MFA code email to {to_email}: {code}")
            self._write_to_mock_inbox(to_email, f"Security Verification Code: {code}", body)
            return True

        try:
            msg = MIMEMultipart()
            msg["From"] = self.sender_email
            msg["To"] = to_email
            msg["Subject"] = f"HotelPlus MFA Verification Code: {code}"
            msg.attach(MIMEText(body, "html"))

            return await asyncio.to_thread(self._send_smtp_email, msg)
        except Exception as e:
            logger.error(f"[Notification] MFA code email failed: {e}")
            return False


# Singleton instance
notification_service = NotificationService()
