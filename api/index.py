"""
EXPLANATION: Serverless Entry Point for Vercel/InsForge
Consolidates the modular FastAPI app into a single function endpoint.
By importing 'app' from backend.main, we preserve all route definitions and middleware.
"""

import os
import sys

# Ensure backend module is resolvable from the root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app as api_app

# The 'app' variable name is required by Vercel's Python runtime
app = api_app
