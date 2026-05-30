"""
Copilot Agent — AI-Powered Revenue Intelligence Advisor
=======================================================
The core conversational agent that powers the Copilot chat interface
inside the hotel rate intelligence dashboard.

Architecture:
  - Uses google-genai SDK (Gemini) with function calling for tool use
  - Maintains a tool registry mapped to CopilotService data access functions
  - Executes multi-turn tool-calling loops (max 5 iterations)
  - Falls back to heuristic keyword-based responses when Gemini is unavailable

Model cascade: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.5-pro
"""

import asyncio
import json
from typing import Any, Dict, List, Optional

from supabase import Client

from backend.services.copilot_service import (
    fetch_competitor_comparison,
    fetch_historical_rates,
    fetch_hotel_context,
    fetch_market_events,
    fetch_parity_alerts,
    fetch_rate_calendar,
    fetch_saved_reports,
    fetch_scan_sessions,
    fetch_sentiment_analysis,
    create_copilot_pdf_report,
    save_hotel_reputation,
    simulate_rate,
)
from backend.utils.ai_client import HAS_GENAI, get_genai_client
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# Type-safe import for google.genai types
try:
    from google.genai import types
except ImportError:

    class _MockTypes:
        def __getattr__(self, name: str) -> Any:
            return None

    types = _MockTypes()  # type: ignore[assignment]


# ── Tool Declarations for Gemini Function Calling ───────────────────────────

TOOL_DECLARATIONS = [
    {
        "name": "get_historical_rates",
        "description": (
            "Fetches historical room rate/price data for a specific hotel "
            "over a given number of days. Use this to answer questions about "
            "pricing trends, rate history, average rates, or price volatility."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to fetch rates for.",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days of history to retrieve (default 30).",
                },
            },
            "required": ["hotel_id"],
        },
    },
    {
        "name": "get_parity_alerts",
        "description": (
            "Retrieves unresolved rate parity violation alerts for a hotel. "
            "Use this when the user asks about OTA pricing issues, undercuts, "
            "parity leaks, or active alerts."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to check alerts for.",
                },
            },
            "required": ["hotel_id"],
        },
    },
    {
        "name": "get_hotel_context",
        "description": (
            "Gets the full list of hotels (targets and competitors) in the "
            "user's portfolio, including names, ratings, and locations. "
            "Use this to understand the user's hotel setup or when no specific "
            "hotel is mentioned."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "simulate_rate_adjustment",
        "description": (
            "Simulates a recommended room rate for a hotel based on a target "
            "occupancy percentage. Uses historical averages and demand multipliers. "
            "Use this for what-if pricing scenarios or rate optimization questions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to simulate rates for.",
                },
                "target_occupancy": {
                    "type": "number",
                    "description": "Desired occupancy percentage (0-100).",
                },
            },
            "required": ["hotel_id", "target_occupancy"],
        },
    },
    {
        "name": "get_competitor_comparison",
        "description": (
            "Compares the target hotel's latest rates against all tracked "
            "competitors. Shows price gaps, market averages, and positioning. "
            "Use this for competitive analysis, benchmarking, or market position questions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the target hotel to compare.",
                },
            },
            "required": ["hotel_id"],
        },
    },
    {
        "name": "get_sentiment_analysis",
        "description": (
            "Fetches a hotel's Guest Rating Index (GRI), sentiment category scores, "
            "guest mentions, and recent review snippets. Use this when the user asks "
            "about reviews, guest satisfaction, cleanliness, service ratings, or "
            "customer feedback."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to fetch sentiment data for.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of recent review snippets to include (default 5).",
                },
            },
            "required": ["hotel_id"],
        },
    },
    {
        "name": "get_scan_sessions",
        "description": (
            "Retrieves the list of recent market scans executed by the user. "
            "Includes date parameters used and agent reasoning traces. Use this "
            "when the user asks when rates were last updated, what search "
            "parameters were used, or about scan history."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of scan sessions to return (default 10).",
                },
            },
        },
    },
    {
        "name": "get_saved_reports",
        "description": (
            "Lists recently saved strategic briefings, executive summaries, and "
            "market reports generated by the user. Use this when the user asks "
            "about their saved reports list or wants to review a past briefing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of reports to return (default 10).",
                },
            },
        },
    },
    {
        "name": "get_market_events",
        "description": (
            "Retrieves upcoming compression events (fairs, holidays, concerts) "
            "for a city that impact demand and pricing. Use this when the user "
            "asks about events in their area, high-demand dates, or local "
            "market alerts."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city name to search events for.",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date filter in YYYY-MM-DD format (optional).",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date filter in YYYY-MM-DD format (optional).",
                },
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_rate_calendar",
        "description": (
            "Fetches forward-looking rate records and room pricing summaries for "
            "a hotel over a specific date range. Use this when the user asks for "
            "pricing on specific dates, weekend vs weekday rates, or calendar trends."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to fetch calendar data for.",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format.",
                },
            },
            "required": ["hotel_id", "start_date", "end_date"],
        },
    },
    {
        "name": "generate_downloadable_pdf",
        "description": (
            "Generates a downloadable PDF briefing containing a strategic market "
            "analysis. Use this when the user explicitly requests a download link, "
            "PDF report, or executive briefing PDF export."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_hotel_id": {
                    "type": "string",
                    "description": "The UUID of the primary hotel for the report.",
                },
                "rival_hotel_id": {
                    "type": "string",
                    "description": "Optional UUID of a rival hotel to include in the comparison.",
                },
                "report_type": {
                    "type": "string",
                    "description": "Title/type of the report (default 'Strategic Market Pulse').",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days of data to include (default 30).",
                },
            },
            "required": ["target_hotel_id"],
        },
    },
    {
        "name": "save_external_reputation_data",
        "description": (
            "Saves reviews, ratings, or reputation scores retrieved from web "
            "searches back into the database. Use this ONLY when the user "
            "explicitly requests to save or update their dashboard with "
            "web-fetched ratings."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "hotel_id": {
                    "type": "string",
                    "description": "The UUID of the hotel to save reputation data for.",
                },
                "source": {
                    "type": "string",
                    "description": "Source of the reputation data (e.g. 'Tripadvisor', 'Google').",
                },
                "rating": {
                    "type": "number",
                    "description": "The overall rating score.",
                },
                "review_count": {
                    "type": "integer",
                    "description": "Total number of reviews (optional).",
                },
                "sentiment_breakdown": {
                    "type": "object",
                    "description": "Category-level sentiment scores (optional).",
                },
                "reviews": {
                    "type": "array",
                    "description": "Array of review objects to save (optional).",
                    "items": {"type": "object"},
                },
            },
            "required": ["hotel_id", "source", "rating"],
        },
    },
]

MAX_TOOL_ITERATIONS = 5

# Models to try in order (cascade)
MODEL_CASCADE = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]



def _build_system_prompt(screen_context: Dict[str, Any]) -> str:
    """
    Constructs a context-aware system prompt for the Copilot agent.

    The prompt positions the agent as a Senior Revenue Intelligence Advisor
    and injects the user's current dashboard context (page, active hotel, etc.)
    so responses are contextually relevant.
    """
    page = screen_context.get("page", "unknown")
    active_hotel_name = screen_context.get("active_hotel_name", "Not selected")
    active_hotel_id = screen_context.get("active_hotel_id")
    active_competitors = screen_context.get("active_competitors") or []
    active_city = screen_context.get("active_city", "Unknown")
    currency = screen_context.get("currency", "TRY")

    profile = screen_context.get("user_profile") or {}
    profile_name = profile.get("display_name", "Enterprise User")
    profile_role = profile.get("role", "Revenue Intelligence")
    profile_plan = profile.get("plan_type", "trial")

    settings = screen_context.get("user_settings") or {}
    threshold = settings.get("threshold_percent", 5.0)
    frequency = settings.get("check_frequency_minutes", 1440)
    notifications = "Enabled" if settings.get("notifications_enabled", False) else "Disabled"

    filters = screen_context.get("filters") or {}

    competitors_text = ", ".join(active_competitors) if active_competitors else "None selected"
    filters_text = json.dumps(filters) if filters else "None"

    return f"""You are the **Senior Revenue Intelligence Advisor** for Tripzy.travel's Hotel Rate Sentinel platform.

## Your Role
- You are an expert in hotel revenue management, pricing strategy, and competitive intelligence.
- You help hoteliers understand their market position, optimize rates, identify parity issues, and make data-driven decisions.
- You have access to real-time tools that query the user's hotel data, alerts, and competitor information.
- You can save web-retrieved reputation data (ratings, reviews) back to the user's hotel profile.
- You have access to sentiment analysis, scan session history, saved reports, market events, and rate calendar tools.

## Communication Style
- Be concise, professional, and actionable.
- Always provide specific numbers and data points when available.
- Use bullet points for readability in longer responses.
- When recommending actions, be specific (e.g., "Increase your rate by 5-8%" rather than "Consider adjusting rates").
- If data is insufficient, say so clearly and suggest what the user can do (e.g., "Run a scan to update your rates").

## Current User Context
- **User Name**: {profile_name}
- **Role**: {profile_role}
- **Plan Type**: {profile_plan}

## Current Dashboard Context
The user is currently viewing:
- **Page**: {page}
- **Active Hotel**: {active_hotel_name} (ID: {active_hotel_id or 'None'})
- **Active City**: {active_city}
- **Preferred Currency**: {currency}
- **Active Filters**: {filters_text}

## User Configuration Settings
- **Violation Threshold**: {threshold}%
- **Scan Frequency**: Every {frequency} minutes
- **Email Notifications**: {notifications}

## Tool Usage Guidelines
- When the user mentions a hotel by name but you need an ID, use `get_hotel_context` first to resolve it.
- If the user asks about "my hotel" or "my rates", use the active hotel ID from the context above.
- For competitor questions, use `get_competitor_comparison` with the active hotel.
- Always prefer fetching real data via tools over making assumptions.
- If a hotel_id is needed but not available from context, ask the user to clarify which hotel they mean.
- Use `save_external_reputation_data` only when the user explicitly asks to save web-fetched data.

## Important Constraints
- Never fabricate data. If a tool returns empty results, acknowledge it honestly.
- Do not provide legal, tax, or financial advice beyond revenue management scope.
- Keep responses focused on actionable intelligence, not generic hospitality advice.
"""


class CopilotAgent:
    """
    AI Copilot Agent with Gemini function calling.

    Orchestrates multi-turn conversations where the LLM can invoke
    data access tools to answer user questions about hotel rates,
    competitors, alerts, and pricing strategy.
    """

    def __init__(self, db: Client, user_id: str):
        self.db = db
        self.user_id = user_id
        self.client = get_genai_client()

    async def _execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Any:
        """
        Dispatches a tool call to the appropriate CopilotService function.

        Args:
            tool_name: Name of the tool to execute.
            args: Arguments dict from the Gemini function call.

        Returns:
            Tool execution result (serializable dict/list).
        """
        logger.info(f"[CopilotAgent] Executing tool: {tool_name} with args: {args}")

        if tool_name == "get_historical_rates":
            return await fetch_historical_rates(
                self.db,
                hotel_id=args.get("hotel_id", ""),
                days=args.get("days", 30),
            )
        elif tool_name == "get_parity_alerts":
            return await fetch_parity_alerts(
                self.db,
                hotel_id=args.get("hotel_id", ""),
            )
        elif tool_name == "get_hotel_context":
            return await fetch_hotel_context(self.db, self.user_id)
        elif tool_name == "simulate_rate_adjustment":
            return await simulate_rate(
                self.db,
                hotel_id=args.get("hotel_id", ""),
                target_occupancy=float(args.get("target_occupancy", 50)),
            )
        elif tool_name == "get_competitor_comparison":
            return await fetch_competitor_comparison(
                self.db,
                user_id=self.user_id,
                hotel_id=args.get("hotel_id", ""),
            )
        elif tool_name == "get_sentiment_analysis":
            return await fetch_sentiment_analysis(
                self.db,
                hotel_id=args.get("hotel_id", ""),
                limit=args.get("limit", 5),
            )
        elif tool_name == "get_scan_sessions":
            return await fetch_scan_sessions(
                self.db,
                user_id=self.user_id,
                limit=args.get("limit", 10),
            )
        elif tool_name == "get_saved_reports":
            return await fetch_saved_reports(
                self.db,
                user_id=self.user_id,
                limit=args.get("limit", 10),
            )
        elif tool_name == "get_market_events":
            return await fetch_market_events(
                self.db,
                city=args.get("city", ""),
                start_date=args.get("start_date"),
                end_date=args.get("end_date"),
            )
        elif tool_name == "get_rate_calendar":
            return await fetch_rate_calendar(
                self.db,
                hotel_id=args.get("hotel_id", ""),
                start_date=args.get("start_date", ""),
                end_date=args.get("end_date", ""),
            )
        elif tool_name == "generate_downloadable_pdf":
            return await create_copilot_pdf_report(
                self.db,
                user_id=self.user_id,
                target_hotel_id=args.get("target_hotel_id", ""),
                rival_hotel_id=args.get("rival_hotel_id"),
                report_type=args.get("report_type", "Strategic Market Pulse"),
                days=args.get("days", 30),
            )
        elif tool_name == "save_external_reputation_data":
            return await save_hotel_reputation(
                self.db,
                hotel_id=args.get("hotel_id", ""),
                source=args.get("source", "Unknown"),
                rating=float(args.get("rating", 0)),
                review_count=args.get("review_count"),
                sentiment_breakdown=args.get("sentiment_breakdown"),
                reviews=args.get("reviews"),
            )
        else:
            logger.warning(f"[CopilotAgent] Unknown tool called: {tool_name}")
            return {"error": f"Unknown tool: {tool_name}"}

    async def chat(
        self,
        message: str,
        history: List[Dict[str, str]],
        screen_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Process a user message through the Copilot agent.

        Workflow:
          1. Build system prompt with screen context
          2. Send message + history to Gemini with function declarations
          3. Execute any tool calls in a loop (max 5 iterations)
          4. Return structured response

        Args:
            message: The user's current message.
            history: List of prior messages with 'role' and 'content' keys.
            screen_context: Current dashboard state (page, active hotel, etc.)

        Returns:
            Dict with keys: reply (str), tool_calls (list), report_data (optional dict)
        """
        # Fallback to heuristic mode if Gemini is unavailable
        if not HAS_GENAI or not self.client:
            logger.warning("[CopilotAgent] Gemini unavailable, using heuristic fallback.")
            return await self._heuristic_response(message, screen_context)

        system_prompt = _build_system_prompt(screen_context)
        tool_calls_log: List[Dict[str, Any]] = []
        report_data: Optional[Dict[str, Any]] = None

        # Build conversation contents for Gemini
        contents = []
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))]))
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

        # Build tool config — custom DB tools
        custom_tools = types.Tool(function_declarations=[
            types.FunctionDeclaration(**decl) for decl in TOOL_DECLARATIONS
        ])
        tools = [custom_tools]

        # Model cascade: try each model until one succeeds
        response = None
        last_error = None
        active_model = None

        for model_name in MODEL_CASCADE:
            try:
                logger.info(f"[CopilotAgent] Attempting chat with model: {model_name}")
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=tools,
                        temperature=0.7,
                    ),
                )
                active_model = model_name
                break
            except Exception as e:
                logger.warning(f"[CopilotAgent] Model {model_name} failed: {e}")
                last_error = e
                continue

        if not response:
            logger.error(f"[CopilotAgent] All models failed. Last error: {last_error}")
            return await self._heuristic_response(message, screen_context)

        # Multi-turn tool-calling loop
        for iteration in range(MAX_TOOL_ITERATIONS):
            # Check if the response contains function calls
            candidate = response.candidates[0] if response.candidates else None
            if not candidate or not candidate.content or not candidate.content.parts:
                break

            function_calls = [
                part for part in candidate.content.parts
                if part.function_call is not None
            ]

            if not function_calls:
                # No more tool calls — we have the final text response
                break

            # Execute each function call
            function_responses = []
            for fc_part in function_calls:
                fc = fc_part.function_call
                tool_name = fc.name
                tool_args = dict(fc.args) if fc.args else {}

                # Execute the tool
                result = await self._execute_tool(tool_name, tool_args)

                tool_calls_log.append({
                    "tool": tool_name,
                    "args": tool_args,
                    "result_preview": str(result)[:500] if result else None,
                })

                # Track report-worthy data
                if tool_name == "get_competitor_comparison" and isinstance(result, dict):
                    report_data = result

                function_responses.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"result": result},
                    )
                )

            # Add the model's function call and our responses to the conversation
            contents.append(candidate.content)
            contents.append(types.Content(role="user", parts=function_responses))

            # Send back to Gemini for next turn
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model=active_model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=tools,
                        temperature=0.7,
                    ),
                )
            except Exception as e:
                logger.error(f"[CopilotAgent] Tool-loop follow-up failed: {e}")
                return {
                    "reply": "I retrieved your data but encountered an error synthesizing the response. Please try again.",
                    "tool_calls": tool_calls_log,
                    "report_data": report_data,
                }

        # Extract final text response
        reply = ""
        if response and response.candidates:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                text_parts = [p.text for p in candidate.content.parts if p.text]
                reply = "\n".join(text_parts)

        if not reply:
            reply = "I wasn't able to generate a response. Could you rephrase your question?"

        return {
            "reply": reply,
            "tool_calls": tool_calls_log,
            "report_data": report_data,
        }

    async def _heuristic_response(
        self,
        message: str,
        screen_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Fallback response engine when Gemini is unavailable.

        Uses keyword matching to identify intent and fetches relevant data
        from the database to provide a data-backed (non-AI) response.
        """
        msg_lower = message.lower()
        hotel_id = screen_context.get("active_hotel_id")
        hotel_name = screen_context.get("active_hotel_name", "your hotel")
        tool_calls_log: List[Dict[str, Any]] = []
        report_data: Optional[Dict[str, Any]] = None

        try:
            # Intent: Rate/Price history
            if any(kw in msg_lower for kw in ["rate", "price", "history", "trend", "average"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel from the dashboard first so I can look up rate data.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                rates = await fetch_historical_rates(self.db, hotel_id, days=30)
                tool_calls_log.append({"tool": "get_historical_rates", "args": {"hotel_id": hotel_id}, "result_preview": f"{len(rates)} records"})

                if rates:
                    prices = [float(r["price"]) for r in rates if r.get("price")]
                    avg = sum(prices) / len(prices) if prices else 0
                    currency = rates[0].get("currency", "TRY")
                    reply = (
                        f"📊 **Rate Summary for {hotel_name}** (Last 30 days)\n\n"
                        f"- **Data Points**: {len(prices)}\n"
                        f"- **Average Rate**: {avg:.2f} {currency}\n"
                        f"- **Range**: {min(prices):.2f} – {max(prices):.2f} {currency}\n\n"
                        f"_Note: AI-powered analysis is currently unavailable. This is a data summary._"
                    )
                else:
                    reply = f"No rate history found for {hotel_name} in the last 30 days. Try running a scan first."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Alerts / Parity
            if any(kw in msg_lower for kw in ["alert", "parity", "undercut", "violation", "leak"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel to check for parity alerts.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                alerts = await fetch_parity_alerts(self.db, hotel_id)
                tool_calls_log.append({"tool": "get_parity_alerts", "args": {"hotel_id": hotel_id}, "result_preview": f"{len(alerts)} alerts"})

                if alerts:
                    alert_lines = "\n".join(
                        f"- **{a.get('severity', 'info').upper()}**: {a.get('message', 'No details')}"
                        for a in alerts[:5]
                    )
                    reply = (
                        f"⚠️ **{len(alerts)} Active Alert(s) for {hotel_name}**\n\n"
                        f"{alert_lines}\n\n"
                        f"{'_Showing first 5 of ' + str(len(alerts)) + ' alerts._' if len(alerts) > 5 else ''}"
                    )
                else:
                    reply = f"✅ No unresolved parity alerts for {hotel_name}. Your rates look clean!"
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Competitor comparison
            if any(kw in msg_lower for kw in ["competitor", "compare", "benchmark", "market", "position"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel to run a competitor comparison.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                comparison = await fetch_competitor_comparison(self.db, self.user_id, hotel_id)
                tool_calls_log.append({"tool": "get_competitor_comparison", "args": {"hotel_id": hotel_id}, "result_preview": comparison.get("summary", "")})
                report_data = comparison
                reply = (
                    f"📈 **Competitor Snapshot for {hotel_name}**\n\n"
                    f"{comparison.get('summary', 'No comparison data available.')}"
                )
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": report_data}

            # Intent: Rate simulation
            if any(kw in msg_lower for kw in ["simulate", "what if", "occupancy", "recommend", "optimal"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel to simulate rates for.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                sim = await simulate_rate(self.db, hotel_id, target_occupancy=70.0)
                tool_calls_log.append({"tool": "simulate_rate_adjustment", "args": {"hotel_id": hotel_id, "target_occupancy": 70}, "result_preview": sim.get("reasoning", "")})
                reply = (
                    f"🎯 **Rate Simulation for {hotel_name}** (70% occupancy target)\n\n"
                    f"{sim.get('reasoning', 'Unable to simulate.')}"
                )
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Sentiment / Reviews
            if any(kw in msg_lower for kw in ["review", "sentiment", "guest", "satisfaction", "rating", "feedback", "tripadvisor"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel from the dashboard so I can fetch sentiment data.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                sentiment = await fetch_sentiment_analysis(self.db, hotel_id, limit=5)
                tool_calls_log.append({"tool": "get_sentiment_analysis", "args": {"hotel_id": hotel_id}, "result_preview": str(sentiment)[:300]})
                if sentiment and isinstance(sentiment, dict):
                    gri = sentiment.get("gri", "N/A")
                    categories = sentiment.get("categories", {})
                    cat_lines = "\n".join(f"  - **{k}**: {v}" for k, v in categories.items()) if categories else "  _No category breakdown available._"
                    reviews_list = sentiment.get("reviews", [])
                    review_lines = "\n".join(f"  - \"{r.get('text', '')}\" — _{r.get('source', 'Guest')}_" for r in reviews_list[:3]) if reviews_list else "  _No recent review snippets._"
                    reply = (
                        f"💬 **Sentiment Summary for {hotel_name}**\n\n"
                        f"- **Guest Rating Index (GRI)**: {gri}\n"
                        f"- **Category Scores**:\n{cat_lines}\n\n"
                        f"**Recent Reviews**:\n{review_lines}\n\n"
                        f"_Note: AI-powered analysis is currently unavailable. This is a data summary._"
                    )
                else:
                    reply = f"No sentiment data found for {hotel_name}. Try running a reputation scan first."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Scan Sessions
            if any(kw in msg_lower for kw in ["scan", "last scan", "update", "crawl", "pulse"]):
                sessions = await fetch_scan_sessions(self.db, user_id=self.user_id, limit=5)
                tool_calls_log.append({"tool": "get_scan_sessions", "args": {}, "result_preview": f"{len(sessions) if isinstance(sessions, list) else 0} sessions"})
                if sessions and isinstance(sessions, list) and len(sessions) > 0:
                    latest = sessions[0]
                    session_lines = "\n".join(
                        f"  - **{s.get('created_at', 'N/A')[:16]}**: {s.get('status', 'unknown')} — {s.get('city', '')} ({s.get('checkin', '')} → {s.get('checkout', '')})"
                        for s in sessions[:5]
                    )
                    reply = (
                        f"🔍 **Recent Scan Sessions**\n\n"
                        f"{session_lines}\n\n"
                        f"_Showing latest {min(len(sessions), 5)} scan(s)._"
                    )
                else:
                    reply = "No scan sessions found. Run a market scan from the dashboard to get started."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Reports
            if any(kw in msg_lower for kw in ["report", "briefing", "saved", "export"]):
                reports = await fetch_saved_reports(self.db, user_id=self.user_id, limit=10)
                tool_calls_log.append({"tool": "get_saved_reports", "args": {}, "result_preview": f"{len(reports) if isinstance(reports, list) else 0} reports"})
                if reports and isinstance(reports, list) and len(reports) > 0:
                    report_lines = "\n".join(
                        f"  - **{r.get('title', 'Untitled')}** — _{r.get('created_at', 'N/A')[:10]}_"
                        for r in reports[:10]
                    )
                    reply = (
                        f"📄 **Saved Reports**\n\n"
                        f"{report_lines}\n\n"
                        f"_Showing {min(len(reports), 10)} report(s)._"
                    )
                else:
                    reply = "No saved reports found. Generate a strategic briefing from the Reports page to get started."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Events
            if any(kw in msg_lower for kw in ["event", "fair", "conference", "festival", "holiday", "compression"]):
                city = screen_context.get("city") or screen_context.get("active_city", "")
                if not city:
                    return {
                        "reply": "I need to know your city to look up market events. Which city should I search?",
                        "tool_calls": [],
                        "report_data": None,
                    }
                events = await fetch_market_events(self.db, city=city)
                tool_calls_log.append({"tool": "get_market_events", "args": {"city": city}, "result_preview": str(events)[:300]})
                if events and isinstance(events, list) and len(events) > 0:
                    event_lines = "\n".join(
                        f"  - 📅 **{e.get('name', 'Unknown')}** — {e.get('start_date', '?')} to {e.get('end_date', '?')} ({e.get('category', '')})"
                        for e in events[:8]
                    )
                    reply = (
                        f"🎪 **Upcoming Events in {city}**\n\n"
                        f"{event_lines}\n\n"
                        f"_These compression events may impact demand and pricing._"
                    )
                else:
                    reply = f"No upcoming events found for {city}."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: Calendar / Dates
            if any(kw in msg_lower for kw in ["calendar", "date", "june", "july", "next week", "weekend", "tomorrow"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel to view the rate calendar.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                from datetime import datetime, timedelta

                today = datetime.utcnow().date()
                start = today.isoformat()
                end = (today + timedelta(days=14)).isoformat()
                calendar = await fetch_rate_calendar(self.db, hotel_id=hotel_id, start_date=start, end_date=end)
                tool_calls_log.append({"tool": "get_rate_calendar", "args": {"hotel_id": hotel_id, "start_date": start, "end_date": end}, "result_preview": str(calendar)[:300]})
                if calendar and isinstance(calendar, list) and len(calendar) > 0:
                    cal_lines = "\n".join(
                        f"  - **{c.get('date', '?')}**: {c.get('price', 'N/A')} {c.get('currency', '')}"
                        for c in calendar[:14]
                    )
                    reply = (
                        f"📅 **Rate Calendar for {hotel_name}** ({start} → {end})\n\n"
                        f"{cal_lines}\n\n"
                        f"_Showing next 14 days._"
                    )
                else:
                    reply = f"No forward-looking rate data found for {hotel_name}. Try running a scan first."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Intent: PDF / Download
            if any(kw in msg_lower for kw in ["pdf", "download", "generate report"]):
                if not hotel_id:
                    return {
                        "reply": "Please select a hotel to generate a PDF report for.",
                        "tool_calls": [],
                        "report_data": None,
                    }
                pdf_result = await create_copilot_pdf_report(
                    self.db,
                    user_id=self.user_id,
                    target_hotel_id=hotel_id,
                    report_type="Strategic Market Pulse",
                    days=30,
                )
                tool_calls_log.append({"tool": "generate_downloadable_pdf", "args": {"target_hotel_id": hotel_id}, "result_preview": str(pdf_result)[:300]})
                if pdf_result and isinstance(pdf_result, dict) and pdf_result.get("download_url"):
                    reply = (
                        f"📥 **PDF Report Generated for {hotel_name}**\n\n"
                        f"Your Strategic Market Pulse report is ready:\n"
                        f"[Download PDF]({pdf_result['download_url']})\n\n"
                        f"_Report: {pdf_result.get('title', 'Strategic Market Pulse')} — Last 30 days._"
                    )
                else:
                    error_msg = pdf_result.get("error", "Unknown error") if isinstance(pdf_result, dict) else "Unknown error"
                    reply = f"I was unable to generate the PDF report: {error_msg}. Please try again later."
                return {"reply": reply, "tool_calls": tool_calls_log, "report_data": None}

            # Default fallback
            return {
                "reply": (
                    "I'm your Revenue Intelligence Advisor for the Hotel Rate Sentinel platform. "
                    "I can help you with:\n\n"
                    "- 📊 **Rate Analysis** — \"What's my average rate this month?\"\n"
                    "- ⚠️ **Parity Alerts** — \"Do I have any active parity violations?\"\n"
                    "- 📈 **Competitor Benchmarking** — \"How do my rates compare to competitors?\"\n"
                    "- 🎯 **Rate Simulation** — \"What rate should I set for 80% occupancy?\"\n"
                    "- 💬 **Sentiment & Reviews** — \"What's my guest satisfaction score?\"\n"
                    "- 🔍 **Scan History** — \"When was my last market scan?\"\n"
                    "- 📄 **Saved Reports** — \"Show me my saved briefings\"\n"
                    "- 🎪 **Market Events** — \"Any upcoming events in my city?\"\n"
                    "- 📅 **Rate Calendar** — \"What are my rates for next week?\"\n"
                    "- 📥 **PDF Export** — \"Generate a PDF report for my hotel\"\n"
                    "- 🌐 **Live Web Search** — \"What's my Tripadvisor rating right now?\"\n\n"
                    "_Note: The AI engine is currently in Safe Mode. I can still fetch and summarize your data._"
                ),
                "tool_calls": [],
                "report_data": None,
            }
        except Exception as e:
            logger.error(f"[CopilotAgent] Heuristic response error: {e}")
            return {
                "reply": "I encountered an error processing your request. Please try again.",
                "tool_calls": tool_calls_log,
                "report_data": report_data,
            }
