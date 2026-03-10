import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

for route in app.routes:
    if hasattr(route, "path"):
        methods = getattr(route, "methods", [])
        print(f"{list(methods)} {route.path}")
