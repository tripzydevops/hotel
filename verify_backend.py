
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

print("Attempting to import backend.main...")
try:
    print("SUCCESS: backend.main imported successfully.")
except Exception as e:
    print(f"FAILURE: Failed to import backend.main: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test Schema Instantiation
try:
    from backend.models.schemas import DashboardResponse
    print("Testing DashboardResponse instantiation...")
    resp = DashboardResponse()
    print("SUCCESS: DashboardResponse instantiated with defaults.")
except Exception as e:
    print(f"FAILURE: DashboardResponse validation error: {e}")
    sys.exit(1)
