from locust import HttpUser, task, between
import random
import uuid

class HotelPlusUserBehavior(HttpUser):
    wait_time = between(1, 5)

    def on_start(self):
        """
        Setup step: we assume the load test runs against a staging environment
        with a valid mock JWT token or basic auth disabled for testing.
        """
        self.session_id = str(uuid.uuid4())
        # In a real environment, you would log in here and save the token
        self.token = "mock-jwt-token-for-load-testing"
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def submit_signals(self):
        """
        Simulates the frontend batching UI signals to the backend.
        This is a critical path for the autonomous agent.
        """
        signals = []
        # Simulate 1 to 10 signals per batch
        for _ in range(random.randint(1, 10)):
            signals.append({
                "signal_type": random.choice(["view", "click", "dwell_time", "scroll"]),
                "payload": {"page": "hotel_detail", "element": "spa_amenity"}
            })

        self.client.post("/api/batch-signals", json={
            "session_id": self.session_id,
            "signals": signals
        }, headers=self.headers)

    @task(1)
    def check_recommendations(self):
        """
        Simulates the user refreshing their recommendations.
        """
        self.client.get("/api/recommendations", headers=self.headers)
