import os
import sys

# Define path to the root directory
path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if path not in sys.path:
    sys.path.append(path)

# Import the FastAPI application from backend.main
from backend.main import app

# Vercel requires the app variable to be exposed
# This file acts as the entry point for Vercel Serverless Functions
