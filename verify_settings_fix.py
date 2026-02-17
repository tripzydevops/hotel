import asyncio
from uuid import uuid4
from backend.api.profile_routes import update_settings
from backend.models.schemas import SettingsUpdate

class MockDB:
    def __init__(self):
        self.call_count = 0

    def table(self, name):
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args):
        return self

    def execute(self):
        # Result object
        class Result:
            data = [{"user_id": "test", "val": "exist"}] # Simulate existing record
        return Result()

    def update(self, data):
        self.call_count += 1
        print(f"MockDB Update called with keys: {list(data.keys())}")
        
        if "push_subscription" in data:
            print("MockDB: Simulating failure for push_subscription...")
            raise Exception("column \"push_subscription\" does not exist")
            
        return self

    def insert(self, data):
        # Similar logic for insert
        if "push_subscription" in data:
            raise Exception("column \"push_subscription\" does not exist")
        return self

async def run_verification():
    print("Verifying policy: update_settings should handle push_subscription failure")
    
    settings = SettingsUpdate(
        threshold_percent=5.0,
        push_subscription={"endpoint": "https://fake.com"} # Simulate frontend sending subscription
    )
    
    db = MockDB()
    try:
        # We need to mock 'existing' check in update_settings
        # My MockDB.select(...).execute().data returns a list, so existing.data is True
        
        # Call the function
        # user_id doesn't matter for mock
        result = await update_settings(uuid4(), settings, db)
        
        print("SUCCESS: update_settings completed without crashing.")
        print(f"Total DB update calls: {db.call_count} (Expected 2: 1 fail, 1 retry)")
        
    except Exception as e:
        print(f"FAIL: update_settings crashed: {e}")

if __name__ == "__main__":
    asyncio.run(run_verification())
