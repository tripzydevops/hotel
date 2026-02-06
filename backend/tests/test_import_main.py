import os
import sys

# Add root to path
sys.path.append(os.getcwd())

print("Attempting to import backend.main...")
try:
    print("SUCCESS: backend.main imported successfully.")
except Exception as e:
    import traceback
    print(f"FAILED to import backend.main: {e}")
    traceback.print_exc()
