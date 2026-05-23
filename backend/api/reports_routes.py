
from backend.models.schemas import ReportsResponse, SuccessResponse
import io
from typing import List, Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
# LINTER FIX: Moved imports to top of file to resolve E402
import uuid
from datetime import datetime, timezone

from backend.models.schemas import BaseModel
from backend.services.report_service import export_report_logic, get_reports_logic
from backend.services.auth_service import (
    get_current_active_user,
    get_current_admin_user,
    get_supabase_rls,
)
from backend.templates.report_templates import (
    build_admin_report_html,
    build_deep_ocean_briefing_html,
)
from backend.utils.db import get_supabase
from supabase import Client

try:
    from xhtml2pdf import pisa
except ImportError:

    class MockPisa:
        @staticmethod
        def CreatePDF(html, dest, **kwargs):
            dest.write(
                b"PDF generation is disabled in this environment (missing xhtml2pdf)"
            )
            return type("Obj", (), {"err": False})()

    pisa = MockPisa()


def generate_pdf_bytes(html_content: str) -> bytes:
    """Helper to run synchronous PDF generation in a threadpool."""
    result = io.BytesIO()
    pisa.CreatePDF(html_content, dest=result)
    return result.getvalue()

router = APIRouter(prefix="/reports", tags=["reports"])


class BriefingRequest(BaseModel):
    target_hotel_id: str
    rival_hotel_id: Optional[str] = None
    days: int = 30
    report_type: Optional[str] = "Strategic Market Pulse"


@router.post("/briefing", response_model=ReportsResponse)
async def generate_briefing(
    request: BriefingRequest,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    EXPLANATION: Agentic Briefing Generation
    Triggers the AnalystAgent to perform semantic benchmarking and
    historical log analysis. The result is automatically persisted
    to the 'reports' table for future retrieval.
    """
    from backend.agents.analyst_agent import AnalystAgent

    agent = AnalystAgent(db)

    result = await agent.generate_executive_briefing(
        user_id=current_user.id,
        target_hotel_id=request.target_hotel_id,
        rival_hotel_id=request.rival_hotel_id,
        days=request.days,
        report_type=request.report_type,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    report_id = str(uuid.uuid4())
    hotel_ids = [request.target_hotel_id]
    if request.rival_hotel_id:
        hotel_ids.append(request.rival_hotel_id)

    report_title = f"Executive Briefing: {result['target']['name']}"
    if result.get('rival'):
        report_title += f" vs {result['rival']['name']}"

    try:
        db.table("reports").insert(
            {
                "id": report_id,
                "title": report_title,
                "report_type": "briefing",
                "hotel_ids": hotel_ids,
                "report_data": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": str(current_user.id),
            }
        ).execute()
        result["id"] = report_id
    except Exception as e:
        # Don't fail the request if saving fails, but log it
        from backend.utils.logger import get_logger
        logger = get_logger(__name__)
        logger.error(f"Failed to persist report: {e}")

    return result


@router.get("/briefing/{report_id}", response_model=Dict[str, Any])
async def get_briefing_detail(
    report_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Fetches the full details of a saved Agentic Briefing.
    """
    res = (
        db.table("reports")
        .select("*")
        .eq("id", str(report_id))
        .eq("created_by", str(current_user.id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return res.data


@router.get("/briefing/saved/{report_id}/pdf")
async def export_saved_briefing_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    EXPLANATION: Saved Briefing PDF Export
    Polished 'Deep Ocean' template with standardized metrics and narrative visibility.
    """
    res = (
        db.table("reports")
        .select("*")
        .eq("id", str(report_id))
        .eq("created_by", str(current_user.id))
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Briefing not found")

    data = res.data
    report_data = data.get("report_data", {})
    metrics = report_data.get("metrics", {})
    narrative = report_data.get("narrative", "No narrative saved.")
    target_meta = report_data.get(
        "target_meta", {"name": "Unknown", "location": "Unknown"}
    )
    created_at = data.get("created_at", "N/A")[:10]

    # CACHE CHECK: Attempt to serve from Supabase Storage
    storage_path = f"briefings/{report_id}.pdf"
    try:
        cached_pdf = db.storage.from_("reports").download(storage_path)
        if cached_pdf:
            return Response(
                content=cached_pdf,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=briefing_saved_{report_id}.pdf"
                },
            )
    except Exception:
        pass

    # PHASE 12: Multi-Lens Dynamic Layouts for Saved Briefings
    context = report_data.get("context", {})
    report_type_clean = context.get("report_type", "Strategic Market Pulse")
    rival_meta = report_data.get("rival_meta")

    middle_cards_html = ""
    if report_type_clean == "Sentiment Deep-Dive":
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Experience Snapshot</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 20px;">{metrics.get("sentiment_snapshot", "N/A")}</div>
                        <div class="metric-label" style="color: #8892b0; margin-top: 10px;">Archived Guest Pillars</div>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Emotional Pulse</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 28px;">{metrics.get("gri", 0)} / 5.0</div>
                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                    </div>
                </td>
            </tr>
        </table>
        """
    elif report_type_clean == "Yield Audit":
        parity_color = (
            "#ff4d4d" if (metrics.get("parity_leaks_count") or 0) > 0 else "#4dff4d"
        )
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Pricing Discipline</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{metrics.get("market_avg_price", 0)}</div>
                        <div class="metric-label" style="color: #8892b0;">Market Baseline ADR</div>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Parity Friction</h2>
                        <div class="metric-val" style="font-size: 22px; color: {parity_color}">
                            {metrics.get("parity_leaks_count", 0)} Leakage Events
                        </div>
                        <div class="metric-label" style="color: #8892b0;">Detected OTA Discrepancies</div>
                    </div>
                </td>
            </tr>
        </table>
        """
    elif report_type_clean == "Competitive Battlefield" or rival_meta:
        rival_name = rival_meta.get("name", "Market") if rival_meta else "Market"
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="100%">
                    <div class="card" style="border-color: #d4af37; background-color: #112240;">
                        <h2 style="color: #d4af37;">The Bout: {target_meta.get("name", "Unknown")} vs {rival_name}</h2>
                        <div class="bout-sim" style="color: #d4af37; font-size: 24px; text-align: center; margin: 20px 0;">{metrics.get("bout_similarity", 0)}% Semantic Similarity</div>
                        <div class="metric-label" style="text-align: center; color: #8892b0;">
                            Strategic Alignment Match: Indexing guest substitution risk based on historical overlaps.
                        </div>
                    </div>
                </td>
            </tr>
        </table>
        """
    else:  # Default: Strategic Market Pulse
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Market Battlefield</h2>
                        <table class="metric-table" style="background-color: #112240;">
                            <tr>
                                <td style="padding: 10px;">
                                    <div class="metric-val" style="color: #ffffff; font-size: 22px;">{metrics.get("market_avg_price", 0)}</div>
                                    <div class="metric-label" style="color: #8892b0;">Avg Rate Index (ARI)</div>
                                </td>
                                <td style="text-align: right; padding: 10px;">
                                    <div class="metric-val" style="color: #ffffff; font-size: 22px;">#{metrics.get("avg_rank", 1)}</div>
                                    <div class="metric-label" style="color: #8892b0;">Avg Search Rank</div>
                                </td>
                            </tr>
                        </table>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Commercial Health</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 28px;">{metrics.get("gri", 0)}</div>
                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                    </div>
                </td>
            </tr>
        </table>
        """

    html_content = build_deep_ocean_briefing_html(
        report_type_clean=report_type_clean,
        target_name=target_meta.get("name", "Unknown"),
        timeframe=context.get("timeframe", "Snapshot Pulse"),
        date_str=created_at,
        middle_cards_html=middle_cards_html,
        narrative=narrative,
        is_archived=True,
    )

    pdf_bytes = await run_in_threadpool(generate_pdf_bytes, html_content)

    # PERSIST TO CACHE
    try:
        db.storage.from_("reports").upload(
            storage_path, pdf_bytes, file_options={"content-type": "application/pdf"}
        )
    except Exception:
        pass

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=briefing_saved_{report_id}.pdf"
        },
    )


@router.get("", response_model=ReportsResponse)
async def get_reports(
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    EXPLANATION: User Report Management
    Lists all saved reports in the database.
    """
    user_id = current_user.id
    return await get_reports_logic(user_id, db)


@router.post("/export", response_model=SuccessResponse)
async def export_report(
    format: str = "csv",
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    Triggers a data export (CSV/Excel) for a specific user report.
    """
    user_id = current_user.id
    return await export_report_logic(user_id, format, db)


@router.get("/{report_id}/pdf")
async def export_report_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user),
):
    """
    Generate and stream a PDF for a specific report (Admin view).
    """
    try:
        report = (
            db.table("reports").select("*").eq("id", str(report_id)).single().execute()
        )
        if not report.data:
            raise HTTPException(status_code=404, detail="Report not found")

        data = report.data
        report_data = data.get("report_data", {})

        # CACHE CHECK: Attempt to serve from Supabase Storage
        storage_path = f"admin_reports/{report_id}.pdf"
        try:
            cached_pdf = db.storage.from_("reports").download(storage_path)
            if cached_pdf:
                return Response(
                    content=cached_pdf,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f"attachment; filename=report_{report_id}.pdf"
                    },
                )
        except Exception:
            pass

        ai_insights_html = "".join(
            [
                f'<div class="insight">{insight}</div>'
                for insight in report_data.get("ai_insights", [])
            ]
        )
        hotels_html = "".join(
            [
                f"""
            <div class="hotel-card">
                <h3>{h["hotel"].get("name", "Unknown Hotel")}</h3>
                <p>{h["hotel"].get("location", "")}</p>
                <table style="width:100%">
                    <tr>
                        <td>
                            <div class="metric">${h["metrics"]["avg_price"]}</div>
                            <div class="label">Avg Price</div>
                        </td>
                        <td>
                            <div class="metric">${h["metrics"]["min_price"]} - ${h["metrics"]["max_price"]}</div>
                            <div class="label">Price Range</div>
                        </td>
                         <td>
                            <div class="metric">{h["metrics"]["data_points"]}</div>
                            <div class="label">Data Points</div>
                        </td>
                    </tr>
                </table>
            </div>
            """
                for h in report_data.get("hotels", [])
            ]
        )

        html_content = build_admin_report_html(
            title=data.get("title", "Market Analysis Report"),
            date_str=datetime.now().strftime("%Y-%m-%d %H:%M"),
            hotel_count=len(data.get("hotel_ids", [])),
            period_months=str(data.get("period_months")),
            ai_insights_html=ai_insights_html,
            hotels_html=hotels_html,
        )

        pdf_bytes = await run_in_threadpool(generate_pdf_bytes, html_content)

        # PERSIST TO CACHE
        try:
            db.storage.from_("reports").upload(
                storage_path,
                pdf_bytes,
                file_options={"content-type": "application/pdf"},
            )
        except Exception:
            pass

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=report_{report_id}.pdf"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/briefing/{target_hotel_id}/pdf")
async def export_briefing_pdf(
    target_hotel_id: str,
    rival_hotel_id: Optional[str] = None,
    days: int = 30,
    report_type: Optional[str] = "Strategic Market Pulse",
    db: Client = Depends(get_supabase_rls),
    current_user=Depends(get_current_active_user),
):
    """
    EXPLANATION: Signature 'Deep Ocean' Agentic PDF Generation
    Regenerates live market pulse with upgraded AI depth and visual styling.
    """
    from backend.agents.analyst_agent import AnalystAgent

    agent = AnalystAgent(db)
    briefing = await agent.generate_executive_briefing(
        user_id=current_user.id,
        target_hotel_id=target_hotel_id,
        rival_hotel_id=rival_hotel_id,
        days=days,
        report_type=report_type,
    )

    if "error" in briefing:
        raise HTTPException(status_code=400, detail=briefing["error"])

    target = briefing["target"]
    rival = briefing["rival"]
    metrics = briefing["metrics"]
    narrative = briefing.get("narrative_raw", "No narrative generated.")

    # PHASE 12: Multi-Lens Dynamic Layouts
    report_type_clean = briefing.get("context", {}).get(
        "report_type", "Strategic Market Pulse"
    )

    middle_cards_html = ""
    if report_type_clean == "Sentiment Deep-Dive":
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Experience Snapshot</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 20px;">{briefing["metrics"].get("sentiment_snapshot", "N/A")}</div>
                        <div class="metric-label" style="color: #8892b0; margin-top: 10px;">Top Guest Pillars</div>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Emotional Pulse</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 28px;">{metrics.get("gri", 0)} / 5.0</div>
                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                    </div>
                </td>
            </tr>
        </table>
        """
    elif report_type_clean == "Yield Audit":
        parity_color = (
            "#ff4d4d" if (metrics.get("parity_leaks_count") or 0) > 0 else "#4dff4d"
        )
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Pricing Discipline</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{metrics.get("market_avg_price", 0)} {target.get("preferred_currency", "TRY")}</div>
                        <div class="metric-label" style="color: #8892b0;">Market Baseline ADR</div>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Parity Friction</h2>
                        <div class="metric-val" style="font-size: 22px; color: {parity_color}">
                            {metrics.get("parity_leaks_count", 0)} Leakage Events
                        </div>
                        <div class="metric-label" style="color: #8892b0;">Detected OTA Discrepancies</div>
                    </div>
                </td>
            </tr>
        </table>
        """
    elif report_type_clean == "Competitive Battlefield" or rival:
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="100%">
                    <div class="card" style="border-color: #d4af37; background-color: #112240;">
                        <h2 style="color: #d4af37;">The Bout: {target["name"]} vs {rival["name"] if rival else "Market"}</h2>
                        <div class="bout-sim" style="color: #d4af37; font-size: 24px; text-align: center; margin: 20px 0;">{metrics.get("bout_similarity", 0)}% Semantic Similarity</div>
                        <div class="metric-label" style="text-align: center; color: #8892b0;">
                            Strategic Alignment Match: Indexing guest substitution risk based on sentiment overlaps.
                        </div>
                    </div>
                </td>
            </tr>
        </table>
        """
    else:  # Default: Strategic Market Pulse
        middle_cards_html = f"""
        <table class="grid-table">
            <tr>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Market Battlefield</h2>
                        <table class="metric-table" style="background-color: #112240;">
                            <tr>
                                <td style="padding: 10px;">
                                    <div class="metric-val" style="color: #ffffff; font-size: 22px;">{metrics.get("market_avg_price", 0)} {target.get("preferred_currency", "TRY")}</div>
                                    <div class="metric-label" style="color: #8892b0;">Avg Rate Index (ARI)</div>
                                </td>
                                <td style="text-align: right; padding: 10px;">
                                    <div class="metric-val" style="color: #ffffff; font-size: 22px;">#{metrics.get("avg_rank", 1)}</div>
                                    <div class="metric-label" style="color: #8892b0;">Avg Search Rank</div>
                                </td>
                            </tr>
                        </table>
                    </div>
                </td>
                <td width="50%">
                    <div class="card" style="background-color: #112240;">
                        <h2 style="color: #d4af37;">Commercial Health</h2>
                        <div class="metric-val" style="color: #ffffff; font-size: 28px;">{metrics.get("gri", 0)}</div>
                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                    </div>
                </td>
            </tr>
        </table>
        """

    html_content = build_deep_ocean_briefing_html(
        report_type_clean=report_type_clean,
        target_name=target["name"],
        timeframe=briefing.get("context", {}).get("timeframe", "30-Day Market Pulse"),
        date_str=datetime.now().strftime("%B %Y"),
        middle_cards_html=middle_cards_html,
        narrative=narrative,
        is_archived=False,
    )

    pdf_bytes = await run_in_threadpool(generate_pdf_bytes, html_content)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=briefing_{target_hotel_id}.pdf"
        },
    )
