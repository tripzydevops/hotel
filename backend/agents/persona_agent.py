import os
import json
import logging
from typing import Dict, List, Any

from backend.config.ai_config import extract_llm_json

import google.generativeai as genai
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


# ---------------------------------------------------------------------------
# B2B Pydantic Output Model
# ---------------------------------------------------------------------------

class CompsetProfileModel(BaseModel):
    """
    Represents a revenue manager's behavioural focus profile inferred from
    their dashboard interaction signals.  Used to personalise market analysis
    narratives and auto-weight competitor importance scores.
    """

    primary_threat: str = Field(
        description=(
            "The competitor hotel name that the hotelier is most focused on "
            "based on their dashboard interactions (most clicks, most dwell time)."
        )
    )
    competitor_weights: Dict[str, float] = Field(
        description=(
            "Normalised attention weights per competitor name (values sum to 1.0). "
            "Higher weight = user spends more time analysing this rival."
        )
    )
    blind_spots: List[str] = Field(
        description=(
            "Competitor hotel names that appear in the compset but receive "
            "little or no interaction — potential strategic blind spots."
        )
    )
    recommended_focus: str = Field(
        description=(
            "One-sentence AI recommendation on which competitor the revenue "
            "manager should pay more attention to and why."
        )
    )
    reasoning_trace: str = Field(
        description="Step-by-step reasoning explaining how the profile was inferred from the signals."
    )


# ---------------------------------------------------------------------------
# Agent Function
# ---------------------------------------------------------------------------

async def build_compset_profile(signals: List[Dict[str, Any]]) -> CompsetProfileModel:
    """
    Analyses a hotelier's raw dashboard interaction signals (clicks, dwell times,
    tab expansions on competitor rows) and returns a CompsetProfileModel describing
    where their competitive attention is focused and where their blind spots are.

    This solves the B2B product intelligence problem: the system learns which
    competitors a revenue manager cares about most, and auto-weights those rivals
    more heavily in subsequent market analysis narratives.
    """
    if not signals:
        return CompsetProfileModel(
            primary_threat="Unknown",
            competitor_weights={},
            blind_spots=[],
            recommended_focus="No interaction signals available. Encourage the user to explore their competitor dashboard.",
            reasoning_trace="No signals provided — cannot infer competitive focus profile.",
        )

    formatted_signals = json.dumps(signals, indent=2)

    prompt = f"""
You are a senior revenue strategy analyst reviewing a hotel revenue manager's
dashboard interaction logs from a competitive intelligence platform (HotelPlus).

Your task is to infer the revenue manager's competitive attention profile from
their implicit UI interactions: which competitor hotels they click on most,
which competitor rows they expand to read pricing details, how long they dwell
on specific competitor cards, and which competitors they routinely ignore.

Raw Dashboard Interaction Signals:
{formatted_signals}

Signal types to look for:
- "competitor_click": User clicked on a competitor hotel card
- "competitor_expand": User expanded the competitor detail panel
- "competitor_tab_selected": User navigated to a specific competitor's tab
- "dwell_time": Time spent (seconds) viewing a page/component (payload has "target" field)
- "click": Generic click (payload has "target" field identifying what was clicked)
- "view": Page view (payload has "page" field)

Instructions:
1. Identify which competitor hotels appear in the signals (by name or hotel_id in payload).
2. Count and weight interaction frequency and dwell time per competitor.
3. Normalise weights so they sum to 1.0 (or close to it).
4. Identify competitors with zero or very low interaction (blind spots).
5. Recommend the one competitor they should pay more attention to.

Output your findings as JSON matching this exact schema:
{{
  "primary_threat": "string — name of most-interacted competitor",
  "competitor_weights": {{"CompetitorName": 0.0, ...}},
  "blind_spots": ["CompetitorName", ...],
  "recommended_focus": "string — one sentence strategic recommendation",
  "reasoning_trace": "string — step-by-step explanation"
}}
"""

    try:
        model = genai.GenerativeModel("gemini-3.1-pro-preview")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            ),
        )

        result_json = extract_llm_json(response.text)
        return CompsetProfileModel(**result_json)

    except Exception as e:
        logger.error(f"Failed to build compset profile: {str(e)}")
        return CompsetProfileModel(
            primary_threat="Unknown",
            competitor_weights={},
            blind_spots=[],
            recommended_focus="Profile inference failed. Please check signal data quality.",
            reasoning_trace=f"Fallback due to inference error: {str(e)}",
        )
