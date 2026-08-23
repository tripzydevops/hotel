"""
conftest.py — Shared pytest fixtures and module mocks for the HotelPlus CI test suite.

WHY MOCKS ARE NEEDED:
Several backend modules import heavy dependencies (pandas, psutil, cairosvg) that
are not required for unit testing and may not be installable in a CI environment.
We mock them at the module level here so that test files that import backend modules
don't crash on import, without needing to stub them in every individual test file.
"""

import sys
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Lightweight CI environment stubs — mock heavy optional packages so tests
# can import backend modules without needing the actual libraries installed
# ---------------------------------------------------------------------------

# Stub pandas — only needed by data aggregation services, not core logic tests
if "pandas" not in sys.modules:
    sys.modules["pandas"] = MagicMock()

# Stub psutil — only needed by system resource monitoring
if "psutil" not in sys.modules:
    sys.modules["psutil"] = MagicMock()

# Stub cairosvg — only needed by PDF export routes
if "cairosvg" not in sys.modules:
    sys.modules["cairosvg"] = MagicMock()

# Stub xhtml2pdf — only needed by PDF export routes
if "xhtml2pdf" not in sys.modules:
    xhtml2pdf_mock = MagicMock()
    sys.modules["xhtml2pdf"] = xhtml2pdf_mock
    sys.modules["xhtml2pdf.pisa"] = xhtml2pdf_mock.pisa

# Stub firecrawl — only needed by market intelligence scraper
if "firecrawl" not in sys.modules:
    sys.modules["firecrawl"] = MagicMock()

# Stub pywebpush — only needed by push notification service
if "pywebpush" not in sys.modules:
    sys.modules["pywebpush"] = MagicMock()
