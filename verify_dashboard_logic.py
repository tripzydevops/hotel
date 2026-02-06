
import sys
import os
import asyncio
from unittest.mock import MagicMock
from uuid import uuid4

# Add project root
sys.path.append(os.getcwd())

from backend.main import get_dashboard

# Mock Supabase Client
class MockDB:
    def table(self, name):
        return self
    
    def select(self, *args, **kwargs):
        return self
        
    def eq(self, *args, **kwargs):
        return self
        
    def order(self, *args, **kwargs):
        return self
        
    def limit(self, *args, **kwargs):
        return self
        
    def in_(self, *args, **kwargs):
        return self
        
    def execute(self):
        # Return empty data structure matching Supabase response
        mock_res = MagicMock()
        mock_res.data = []
        return mock_res

async def run_test():
    print("Testing get_dashboard with Mock DB...")
    mock_db = MockDB()
    user_id = uuid4()
    
    try:
        # Call the function
        result = await get_dashboard(user_id, mock_db)
        print(f"SUCCESS: get_dashboard returned type: {type(result)}")
        print(f"Data: target={result.target_hotel}, alerts={result.unread_alerts_count}")
    except Exception as e:
        print(f"FAILURE: get_dashboard crashed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
