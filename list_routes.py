
from backend.main import app

for route in app.routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', None)
        print(f"{methods} {route.path}")
