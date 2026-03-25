# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
import sys

# Ensure backend module is resolvable from the root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app as api_app

# The 'app' variable name is required by Vercel's Python runtime
app = api_app
