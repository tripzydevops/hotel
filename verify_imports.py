import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    print("Attempting to import all API routers...")
    from backend.api import (
        admin_routes, hotel_routes, monitor_routes, dashboard_routes,
        reports_routes, profile_routes, analysis_routes, alerts_routes,
        landing_routes, pulse_routes
    )
    print("✅ Successfully imported all API routers")
except Exception as e:
    print(f"❌ Failed to import API routers: {e}")
    import traceback
    traceback.print_exc()

try:
    print("\nAttempting to import backend.main...")
    import backend.main
    print("✅ Successfully imported backend application")
except Exception as e:
    print(f"❌ Failed to import backend application: {e}")
    import traceback
    traceback.print_exc()
