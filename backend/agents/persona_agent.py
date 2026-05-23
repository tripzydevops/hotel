import os
import json
import logging
from typing import List, Dict, Any
from pydantic import BaseModel, Field
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class TravelPersonaModel(BaseModel):
    primary_archetype: str = Field(description="The primary travel persona archetype (e.g., 'Wellness Explorer', 'Budget Backpacker').")
    implied_preferences: List[str] = Field(description="A list of 3-5 specific implied preferences (e.g., 'Nature', 'High-End Amenities', 'Dogs').")
    reasoning_trace: str = Field(description="Step-by-step reasoning explaining why this persona was inferred based on the signals.")

async def infer_travel_persona(signals: List[Dict[str, Any]]) -> TravelPersonaModel:
    """
    Takes raw behavioral signals and translates them into a semantic travel persona.
    """
    if not signals:
        return TravelPersonaModel(
            primary_archetype="Unknown",
            implied_preferences=[],
            reasoning_trace="No signals provided for inference."
        )

    # Format signals for the LLM
    formatted_signals = json.dumps(signals, indent=2)
    
    prompt = f"""
You are an expert behavioral analyst for a next-generation travel recommendation engine.
Your task is to solve the 'Cold Start' problem by inferring a user's travel persona from their implicit interactions with our platform.

Raw Behavioral Signals:
{formatted_signals}

Analyze these signals (what they clicked on, what amenities they viewed, how long they dwelled, what filters they applied).
If a user lacks travel history, look for lifestyle/behavioral signals to infer preferences.
Output your findings in JSON matching the exact schema below.

JSON Schema:
{{
  "primary_archetype": "string",
  "implied_preferences": ["string", "string"],
  "reasoning_trace": "string"
}}
"""

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        result_json = json.loads(response.text)
        return TravelPersonaModel(**result_json)
        
    except Exception as e:
        logger.error(f"Failed to infer persona: {str(e)}")
        # Fallback if LLM fails
        return TravelPersonaModel(
            primary_archetype="General Traveler",
            implied_preferences=["Exploration", "Comfort"],
            reasoning_trace=f"Fallback due to inference error: {str(e)}"
        )
