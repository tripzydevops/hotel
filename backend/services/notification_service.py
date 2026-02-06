"""
Notification Service
Handles sending email notifications for alerts.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

class NotificationService:
    """Service for sending notifications."""
    
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.sender_email = os.getenv("SENDER_EMAIL", self.smtp_user)
        self.enabled = bool(self.smtp_user and self.smtp_password)

    async def send_notifications(
        self,
        settings: dict,
        hotel_name: str,
        alert_message: str,
        current_price: float,
        previous_price: float,
        currency: str = "USD"
    ) -> dict:
        """
        Send notifications via all enabled channels.
        """
        results = {
            "email": False,
            "whatsapp": False,
            "push": False
        }

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
                currency
            )

        # 2. WhatsApp (Placeholder)
        if settings.get("whatsapp_number"):
            results["whatsapp"] = await self.send_whatsapp(
                settings["whatsapp_number"],
                alert_message
            )

        # 3. Push
        if settings.get("push_enabled") and settings.get("push_subscription"):
            results["push"] = await self.send_push(
                settings.get("user_id"), 
                alert_message,
                subscription=settings.get("push_subscription")
            )
            
        return results

    async def send_whatsapp(self, number: str, message: str) -> bool:
        """Placeholder for WhatsApp integration (e.g. Twilio)"""
        # TODO: Implement Twilio/Meta API
        print(f"[Notification] WOULD send WhatsApp to {number}: {message}")
        return True

    async def send_push(self, user_id: str, message: str, subscription: dict = None) -> bool:
        """
        Send Web Push notification.
        """
        if not subscription:
            print(f"[Notification] No subscription found for user {user_id}")
            return False

        try:
            from pywebpush import webpush, WebPushException
            
            # Get VAPID private key from env
            private_key = os.getenv("VAPID_PRIVATE_KEY")
            if not private_key:
                print("[Notification] VAPID_PRIVATE_KEY not set")
                return False

            claims = {
                "sub": os.getenv("VAPID_SUBJECT", "mailto:admin@rate-sentinel.com")
            }

            webpush(
                subscription_info=subscription,
                data=message,
                vapid_private_key=private_key,
                vapid_claims=claims
            )
            print(f"[Notification] Push sent to {user_id}")
            return True
            
        except ImportError:
            print("[Notification] pywebpush not installed")
            return False
        except Exception as e:
            print(f"[Notification] Push failed: {e}")
            return False

    async def send_alert_email(
        self,
        to_email: str,
        hotel_name: str,
        alert_message: str,
        current_price: float,
        previous_price: float,
        currency: str = "USD"
    ) -> bool:
        """
        Send an alert email to the user.
        """
        if not self.enabled:
            print(f"[Notification] Email disabled. Would have sent to {to_email}: {alert_message}")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = self.sender_email
            msg["To"] = to_email
            msg["Subject"] = f"Price Alert: {hotel_name}"

            body = f"""
            <html>
              <body>
                <h2>Price Change Alert for {hotel_name}</h2>
                <p>{alert_message}</p>
                <ul>
                  <li><strong>Current Price:</strong> {currency} {current_price}</li>
                  <li><strong>Previous Price:</strong> {currency} {previous_price}</li>
                </ul>
                <p><a href="http://localhost:3000">View Dashboard</a></p>
              </body>
            </html>
            """
            msg.attach(MIMEText(body, "html"))

            # Synchronous SMTP call (could be made async with aiosmtplib if needed, 
            # but for low volume this is acceptable)
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            print(f"[Notification] Sent email to {to_email}")
            return True

        except Exception as e:
            print(f"[Notification] Failed to send email: {e}")
            return False

# Singleton instance
notification_service = NotificationService()
