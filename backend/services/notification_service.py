"""
Notification Service
Handles sending email notifications for alerts.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
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
