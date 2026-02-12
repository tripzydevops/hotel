import os
import sys

# Define path to the root directory
path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if path not in sys.path:
    sys.path.append(path)

# Import the FastAPI application from backend.main
from backend.main import app as _app  # noqa: E402, F401

# Vercel requires the app variable to be exposed
app = _app
