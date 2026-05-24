from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SignalPayload(BaseModel):
    signal_type: str = Field(
        ...,
        description=(
            "The type of interaction. "
            "B2B-relevant types: 'competitor_click', 'competitor_expand', "
            "'competitor_tab_selected', 'dwell_time', 'alert_investigated', "
            "'alert_dismissed', 'click', 'view'."
        ),
    )
    payload: Dict[str, Any] = Field(
        ...,
        description="Contextual data about the interaction (e.g., hotel_id, competitor_name, duration_seconds).",
    )
    timestamp: Optional[str] = Field(
        None, description="ISO8601 timestamp of when the event occurred on the client."
    )


class BatchSignalRequest(BaseModel):
    session_id: str = Field(
        ...,
        description="A unique identifier for the anonymous or logged-in session.",
    )
    signals: List[SignalPayload] = Field(
        ...,
        max_items=100,
        description="An array of user signals to be ingested (max 100 per batch).",
    )


class BatchSignalResponse(BaseModel):
    success: bool = Field(..., description="Indicates if the ingestion was successful.")
    count: int = Field(..., description="Number of signals ingested.")
    warning: Optional[str] = Field(
        None, description="Optional warning message if the DB is under load."
    )


class GhostCompetitorResponse(BaseModel):
    """
    A single ghost competitor suggestion returned by the semantic discovery engine.

    Ghost competitors are hotels that are semantically similar to the target hotel
    (based on location, category, star rating, amenities, and description) but
    have NOT been manually added to the hotelier's compset yet.

    This powers the B2B Cold Start Solver: when a new hotel is added with no
    configured competitors, the system instantly suggests the most relevant rivals.
    """

    hotel_id: str = Field(..., description="UUID of the suggested competitor hotel.")
    name: str = Field(..., description="Hotel name.")
    location: str = Field(..., description="Hotel location.")
    similarity_score: float = Field(
        ...,
        description=(
            "Cosine similarity score (0.0–1.0) between this hotel's semantic "
            "profile vector and the target hotel's vector. Higher = more similar."
        ),
    )


class CompsetProfileResponse(BaseModel):
    """
    The result of the B2B Compset Intelligence Agent analysis.
    Describes which competitors a revenue manager focuses on most,
    and where their strategic blind spots are.
    """

    primary_threat: str = Field(
        ..., description="The competitor hotel the user interacts with most."
    )
    competitor_weights: Dict[str, float] = Field(
        ...,
        description="Normalised attention weights per competitor (sum ≈ 1.0).",
    )
    blind_spots: List[str] = Field(
        ...,
        description="Competitors in the compset that the user rarely or never inspects.",
    )
    recommended_focus: str = Field(
        ..., description="AI-generated one-sentence strategic recommendation."
    )
    reasoning_trace: str = Field(
        ..., description="LLM explanation of how the profile was inferred."
    )
