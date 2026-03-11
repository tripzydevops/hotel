# AI Insights & Reporting Improvements (March 2026)

This document outlines the recent architectural and generative AI upgrades applied to the Hotel Rate Sentinel reporting modules.

## 1. Generative AI Prompt Upgrades (`AnalystAgent.py`)
Previously, the `AnalystAgent` utilized a generic, conversational prompt for generating the final "Agentic Executive Briefing." While informative, the output lacked the rigorous structure required by hotel revenue managers.

**The Upgrade**:
The `Strategic Market Pulse` prompt has been entirely rewritten to enforce a strict, 3-part **McKinsey/HBR strategic framework**. The AI must now output precise, bullet-pointed markdown without conversational filler.

The enforced structure is:
1.  **Commercial Health**
    *   **Current State:** [1 sentence fact based on GRI and Benchmark]
    *   **Vulnerability:** [1 sentence identifying revenue loss or perception risk]
    *   **Action Plan:** [1 sentence specific, immediate directive]
2.  **Visibility & Positioning**
    *   **Current State:** [1 sentence fact based on Search Rank and Pricing DNA]
    *   **Vulnerability:** [1 sentence identifying demand capture risk or OTA friction]
    *   **Action Plan:** [1 sentence strategic pricing adjustment directive]
3.  **The Executive Pivot**
    *   **Current State:** [1 sentence summarizing the 30-day outlook]
    *   **Vulnerability:** [1 sentence on the biggest threat]
    *   **Action Plan:** [1 sentence specific forward pricing recommendation (e.g., "Increase standard rate by X%")]

This exact formatting ensures consistent, high-density, actionable advice.

## 2. Event Loop Unblocking (`reports_routes.py`)
The system generates dynamic, highly-styled PDF reports ("Deep Ocean" styling) using the `xhtml2pdf` library.

**The Critical Problem**:
`xhtml2pdf` is a heavily synchronous, CPU-bound library. Because it was being executed directly inside asynchronous (`async def`) FastAPI routes, the PDF generation process was blocking the entire Python event loop. During the 2-5 seconds it took to generate a PDF, the server could not process *any* other requests, leading to severe scaling bottlenecks and potential timeouts for concurrent users.

**The Solution**:
All PDF generation logic has been wrapped in a synchronous helper function (`generate_pdf_bytes`) and dispatched to a background thread pool:
```python
pdf_bytes = await run_in_threadpool(generate_pdf_bytes, html_content)
```
This frees the main FastAPI event loop, allowing the server to handle hundreds of concurrent requests even while heavy PDFs are rendering in the background.

## 3. HTML Template Extraction (`report_templates.py`)
Previously, over 500 lines of complex HTML string concatenation were hardcoded directly inside the route logic in `backend/api/reports_routes.py`.

**The Upgrade**:
To improve maintainability and separate concerns, this HTML has been extracted into a dedicated templating module: `backend/templates/report_templates.py`. 
The API routes now simply call `build_deep_ocean_briefing_html()` or `build_admin_report_html()` and pass in the necessary dynamic variables. This significantly cleans up the routing logic and makes future UI modifications to the PDFs much easier.
