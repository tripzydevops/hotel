import asyncio
from uuid import uuid4
from backend.api.profile_routes import update_settings
from backend.models.schemas import SettingsUpdate
from fastapi import HTTPException

# Mock DB client
class MockDB:
    def table(self, name):
        return self
    def update(self, data):
        print(f"Update called on '{self.table_name if hasattr(self, 'table_name') else 'unknown'}' with: {data}")
        # Simulate failure if push_subscription is in data (assuming column missing)
        if "push_subscription" in data:
            raise Exception("column \"push_subscription\" of relation \"settings\" does not exist")
        return self
    def select(self, *args, **kwargs):
        return self
    def eq(self, *args):
        return self
    def execute(self):
        class Result:
            data = [{"user_id": "test", "created_at": "now", "updated_at": "now"}]
        return Result()

async def repro_crash():
    print("Running reproduction: update_settings with push_subscription=None")
    
    user_id = uuid4()
    settings = SettingsUpdate(
        threshold_percent=2.5,
        push_subscription=None # Explicitly None
    )
    
    # We need to mock get_supabase dependency or just call function with mock db
    mock_db = MockDB()
    mock_db.table_name = "settings" # Hack for print

    try:
        # We need to simulate the environment where the DB is real, but here we mock to see logic flow.
        # But wait, checking for "push_subscription" in update_data logic is what I want to test.
        # If I mock DB to fail on push_subscription, then I confirm my hypothesis.
        # But I want to see if MY CODE sends it.
        pass
    except Exception as e:
        print(f"Setup Error: {e}")

    # Real test requires running against the *actual* code path logic
    # I'll replicate the relevant logic block from profile_routes.py
    
    update_data = settings.model_dump(exclude_unset=True)
    print(f"Payload to DB: {update_data}")
    
    if "push_subscription" in update_data:
        print("Bug Confirmed: push_subscription is in payload (as None)")
    else:
        print("Payload clean: push_subscription not in payload")

if __name__ == "__main__":
    asyncio.run(repro_crash())
