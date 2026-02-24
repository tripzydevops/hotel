import os
import sys
from fastapi.testclient import TestClient

# Define path to the root directory
path = os.path.abspath(os.path.join(os.getcwd()))
if path not in sys.path:
    sys.path.append(path)

try:
    from api.index import app
    client = TestClient(app)
    
    paths_to_test = [
        "/api/dashboard/eb284dd9-7198-47be-acd0-fdb0402bcd0a"
    ]
    
    print(f"Testing routes with VERCEL=1 simulated...")
    os.environ["VERCEL"] = "1"
    
    for p in paths_to_test:
        response = client.get(p)
        print(f"Path: {p} -> Status: {response.status_code}")
        if response.status_code == 404:
            print(f"  FAILED to match {p}")
        else:
            print(f"  SUCCESS matching {p}")

except Exception as e:
    import traceback
    traceback.print_exc()
