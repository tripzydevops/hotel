
import sys
import os
sys.path.append(os.getcwd())

try:
    from backend.main import app
    print("Routes registered in backend.main:")
    for route in app.routes:
        methods = getattr(route, 'methods', None)
        print(f"Path: {route.path}, Methods: {methods}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
