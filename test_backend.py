import sys
import os

# Add root to sys.path
sys.path.append(os.getcwd())

try:
    print("Attempting to import backend.main...")
    from backend.main import app
    print("Successfully imported backend.main")
except Exception as e:
    print(f"Import Error: {e}")
    sys.exit(1)
