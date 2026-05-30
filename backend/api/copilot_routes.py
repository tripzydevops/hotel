"""
Copilot Routes — FastAPI Router for the AI Copilot Agent
========================================================
Provides the /copilot/chat endpoint that powers the in-dashboard
conversational AI assistant.

Authentication: Requires a valid user session via InsForge JWT.
Authorization: Uses RLS-scoped database client for all data access.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client

from backend.agents.copilot_agent import CopilotAgent
from backend.services.auth_service import get_current_active_user, get_supabase_rls
from backend.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


# ── Pydantic Models ────────────────────────────────────────────────────────


class ScreenContext(BaseModel):
    """Captures the user's current dashboard state for contextual responses."""

    page: str = Field(
        default="dashboard",
        description="Current page the user is viewing (e.g., 'dashboard', 'reports', 'alerts').",
    )
    active_hotel_id: Optional[str] = Field(
        default=None,
        description="UUID of the currently selected hotel.",
    )
    active_hotel_name: Optional[str] = Field(
        default=None,
        description="Display name of the currently selected hotel.",
    )
    active_competitors: Optional[List[str]] = Field(
        default=None,
        description="List of competitor hotel names currently visible.",
    )
    active_city: Optional[str] = Field(
        default=None,
        description="Parsed city location of the active hotel.",
    )
    currency: Optional[str] = Field(
        default=None,
        description="Active dashboard display currency.",
    )
    user_profile: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Current user profile information.",
    )
    user_settings: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Current user configurations/settings.",
    )
    filters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Active filter state on the current page.",
    )


class CopilotMessage(BaseModel):
    """A single message in the conversation history."""

    role: str = Field(
        ...,
        description="Message role: 'user' or 'assistant'.",
        pattern="^(user|assistant)$",
    )
    content: str = Field(
        ...,
        description="Text content of the message.",
    )


class CopilotChatRequest(BaseModel):
    """Request payload for the Copilot chat endpoint."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's current message.",
    )
    history: List[CopilotMessage] = Field(
        default_factory=list,
        description="Previous messages in the conversation.",
    )
    screen_context: ScreenContext = Field(
        default_factory=ScreenContext,
        description="Current dashboard context for the user.",
    )


class CopilotChatResponse(BaseModel):
    """Structured response from the Copilot agent."""

    reply: str = Field(
        ...,
        description="The agent's text response.",
    )
    tool_calls: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of tools invoked during this response cycle.",
    )
    report_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured report data (e.g., competitor comparison) for frontend rendering.",
    )


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(
    body: CopilotChatRequest,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Copilot Chat Endpoint.

    Accepts a user message with conversation history and dashboard context,
    routes it through the CopilotAgent (with Gemini function calling),
    and returns a structured response with the AI reply, tool call log,
    and optional report data.

    Requires authenticated user session.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = str(current_user.id)

    try:
        # Convert Pydantic models to dicts for the agent
        history_dicts = [msg.model_dump() for msg in body.history]
        context_dict = body.screen_context.model_dump()

        # Create and invoke the Copilot agent
        agent = CopilotAgent(db=db, user_id=user_id)
        result = await agent.chat(
            message=body.message,
            history=history_dicts,
            screen_context=context_dict,
        )

        return CopilotChatResponse(
            reply=result.get("reply", "No response generated."),
            tool_calls=result.get("tool_calls", []),
            report_data=result.get("report_data"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CopilotRoutes] Chat endpoint error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Copilot service encountered an internal error.",
        )
