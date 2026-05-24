from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SignalPayload(BaseModel):
    signal_type: str = Field(..., description="The type of interaction (e.g., 'dwell', 'click', 'scroll')")
    payload: Dict[str, Any] = Field(..., description="Contextual data about the interaction")
    timestamp: Optional[str] = Field(None, description="ISO8601 timestamp of when the event occurred on the client")

class BatchSignalRequest(BaseModel):
    session_id: str = Field(..., description="A unique identifier for the anonymous or logged-in session")
    signals: List[SignalPayload] = Field(..., max_items=100, description="An array of user signals to be ingested")

class BatchSignalResponse(BaseModel):
    success: bool = Field(..., description="Indicates if the ingestion was successful")
    count: int = Field(..., description="Number of signals ingested")
    warning: Optional[str] = Field(None, description="Optional warning message if the DB is under load")

class RecommendationResponse(BaseModel):
    hotel_id: str = Field(..., description="The ID of the recommended hotel")
    name: str = Field(..., description="The name of the hotel")
    similarity_score: float = Field(..., description="Cosine similarity score against the user persona embedding")
