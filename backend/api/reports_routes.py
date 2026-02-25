from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from supabase import Client
from backend.utils.db import get_supabase
from backend.services.auth_service import get_current_active_user, get_current_admin_user
from backend.services.admin_service import get_reports_logic, export_report_logic
from backend.models.schemas import BaseModel

router = APIRouter(prefix="/api/reports", tags=["reports"])

class BriefingRequest(BaseModel):
    target_hotel_id: str
    rival_hotel_id: Optional[str] = None
    days: int = 30

@router.post("/briefing")
async def generate_briefing(
    request: BriefingRequest,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
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
        days=request.days
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result

@router.get("/briefing/{report_id}")
async def get_briefing_detail(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    Fetches the full details of a saved Agentic Briefing.
    """
    res = db.table("reports").select("*").eq("id", str(report_id)).eq("created_by", str(current_user.id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return res.data

@router.get("/briefing/saved/{report_id}/pdf")
async def export_saved_briefing_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    EXPLANATION: Saved Briefing PDF Export
    Polished 'Deep Ocean' template with standardized metrics and narrative visibility.
    """
    from xhtml2pdf import pisa
    import io
    
    res = db.table("reports").select("*").eq("id", str(report_id)).eq("created_by", str(current_user.id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Briefing not found")
        
    data = res.data
    report_data = data.get("report_data", {})
    metrics = report_data.get("metrics", {})
    narrative = report_data.get("narrative", "No narrative saved.")
    target_meta = report_data.get("target_meta", {"name": "Unknown", "location": "Unknown"})
    
    html_content = f"""
    <html>
    <head>
        <style>
            @page {{ size: A4; margin: 0; }}
            body {{ 
                font-family: 'Helvetica', sans-serif; 
                background-color: #0a192f; 
                color: #e6f1ff; 
                margin: 0; 
                padding: 40px;
            }}
            .report-wrapper {{ width: 100%; }}
            .header-table {{ width: 100%; border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 40px; }}
            h1 {{ color: #d4af37; margin: 0; font-size: 28px; }}
            .cadence {{ color: #8892b0; font-size: 14px; text-transform: uppercase; }}
            .grid-table {{ width: 100%; border-spacing: 20px 0; }}
            .card {{ 
                background-color: #112240; 
                border: 1px solid #d4af37; 
                border-radius: 12px; 
                padding: 20px; 
                margin-bottom: 20px;
                vertical-align: top;
            }}
            h2 {{ color: #d4af37; font-size: 18px; margin-top: 0; border-left: 3px solid #d4af37; padding-left: 10px; }}
            .metric-table {{ width: 100%; }}
            .metric-val {{ font-weight: bold; color: #fff; font-size: 20px; }}
            .metric-label {{ color: #8892b0; font-size: 12px; }}
            .narrative {{ line-height: 1.6; font-size: 14px; color: #ccd6f6; white-space: pre-line; }}
            .footer {{ 
                margin-top: 50px; 
                text-align: center; 
                color: #8892b0; 
                font-size: 12px; 
                border-top: 1px solid #233554;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="report-wrapper">
            <table class="header-table">
                <tr>
                    <td>
                        <h1>{report_data.get('context', {}).get('report_type', 'Executive Briefing (Saved)')}</h1>
                        <div class="cadence">{target_meta['name']} | {report_data.get('context', {}).get('timeframe', 'Historical Pulse Snapshot')}</div>
                    </td>
                    <td style="text-align: right; vertical-align: bottom;">
                        <div class="cadence">{data['created_at'][:10]}</div>
                    </td>
                </tr>
            </table>

            <table class="grid-table">
                <tr>
                    <td width="50%">
                        <div class="card" style="background-color: #112240;">
                            <h2 style="color: #d4af37;">Market Battlefield</h2>
                            <table class="metric-table" style="background-color: #112240;">
                                <tr>
                                    <td style="padding: 10px;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{(metrics.get('avg_price') or 0)}</div>
                                        <div class="metric-label" style="color: #8892b0;">Avg Rate Index (ARI)</div>
                                    </td>
                                    <td style="text-align: right; padding: 10px;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">#{(metrics.get('avg_rank') or 1)}</div>
                                        <div class="metric-label" style="color: #8892b0;">Avg Search Rank</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding: 10px; border-top: 1px solid #233554;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{(metrics.get('gri') or 0)}</div>
                                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                    <td width="50%">
                        <div class="card" style="background-color: #112240;">
                            <h2 style="color: #d4af37;">The Friction</h2>
                            <div class="metric-val" style="font-size: 22px; color: {'#ff4d4d' if (metrics.get('parity_leaks_count') or 0) > 0 else '#4dff4d'}">
                                {(metrics.get('parity_leaks_count') or 0)} Parity Leaks
                            </div>
                            <div class="metric-label" style="color: #8892b0;">Detected via direct log vs OTA benchmark</div>
                        </div>
                    </td>
                </tr>
            </table>

            {f'''
            <div class="card" style="border-color: #d4af37; background-color: #112240;">
                <h2 style="color: #d4af37;">The Bout</h2>
                <div class="bout-sim" style="color: #d4af37; font-size: 24px; text-align: center; margin: 20px 0;">{metrics.get('bout_similarity', 0)}% Semantic Similarity</div>
                <div class="metric-label" style="text-align: center; color: #8892b0;">Strategic Alignment Index</div>
            </div>
            ''' if metrics.get('bout_similarity') is not None else ""}

            <div class="card" style="background-color: #112240;">
                <h2 style="color: #d4af37;">🤖 AI Strategic Narrative</h2>
                <div class="narrative">{narrative}</div>
            </div>

            <div class="footer">
                Intelligence archived by Agentic Tripzy Hub | Powered by Gemini-3-Flash
            </div>
        </div>
    </body>
    </html>
    """
    
    result = io.BytesIO()
    pisa.CreatePDF(html_content, dest=result)
    pdf_bytes = result.getvalue()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=briefing_saved_{report_id}.pdf"}
    )

@router.get("/{user_id}")
async def get_reports(user_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """
    EXPLANATION: User Report Management
    Lists all saved reports in the database.
    """
    return await get_reports_logic(user_id, db)

@router.post("/{user_id}/export")
async def export_report(user_id: UUID, format: str = "csv", db: Client = Depends(get_supabase)):
    """
    Triggers a data export (CSV/Excel) for a specific user report.
    """
    return await export_report_logic(user_id, format, db)

@router.get("/{report_id}/pdf")
async def export_report_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Generate and stream a PDF for a specific report (Admin view).
    """
    try:
        report = db.table("reports").select("*").eq("id", str(report_id)).single().execute()
        if not report.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        data = report.data
        report_data = data.get("report_data", {})
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Helvetica', sans-serif; color: #333; padding: 40px; }}
                h1 {{ color: #047857; border-bottom: 2px solid #047857; padding-bottom: 10px; }}
                h2 {{ color: #333; margin-top: 30px; }}
                .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
                .insight {{ background: #ecfdf5; padding: 15px; border-left: 4px solid #047857; margin-bottom: 10px; }}
                .hotel-card {{ border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }}
                .metric {{ font-size: 1.2em; font-weight: bold; }}
                .label {{ font-size: 0.8em; color: #666; text-transform: uppercase; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #eee; }}
            </style>
        </head>
        <body>
            <h1>{data.get('title', 'Market Analysis Report')}</h1>
            <div class="meta">
                Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>
                Includes: {len(data.get('hotel_ids', []))} hotels | Period: {data.get('period_months')} months
            </div>

            <h2>🤖 AI Executive Summary</h2>
            {"".join([f'<div class="insight">{insight}</div>' for insight in report_data.get("ai_insights", [])])}

            <h2>🏨 Hotel Analysis</h2>
            {"".join([
                f'''
                <div class="hotel-card">
                    <h3>{h['hotel'].get('name', 'Unknown Hotel')}</h3>
                    <p>{h['hotel'].get('location', '')}</p>
                    <table style="width:100%">
                        <tr>
                            <td>
                                <div class="metric">${h['metrics']['avg_price']}</div>
                                <div class="label">Avg Price</div>
                            </td>
                            <td>
                                <div class="metric">${h['metrics']['min_price']} - ${h['metrics']['max_price']}</div>
                                <div class="label">Price Range</div>
                            </td>
                             <td>
                                <div class="metric">{h['metrics']['data_points']}</div>
                                <div class="label">Data Points</div>
                            </td>
                        </tr>
                    </table>
                </div>
                ''' for h in report_data.get("hotels", [])
            ])}
            
            <div style="margin-top: 50px; text-align: center; color: #999; font-size: 0.8em;">
                Generated by Tripzy.travel Intelligence Hub
            </div>
        </body>
        </html>
        """

        import io
        from xhtml2pdf import pisa
        result = io.BytesIO()
        pisa.CreatePDF(html_content, dest=result)
        pdf_bytes = result.getvalue()
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/briefing/{target_hotel_id}/pdf")
async def export_briefing_pdf(
    target_hotel_id: str,
    rival_hotel_id: Optional[str] = None,
    days: int = 30,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    EXPLANATION: Signature 'Deep Ocean' Agentic PDF Generation
    Regenerates live market pulse with upgraded AI depth and visual styling.
    """
    from backend.agents.analyst_agent import AnalystAgent
    import io
    from xhtml2pdf import pisa
    
    agent = AnalystAgent(db)
    briefing = await agent.generate_executive_briefing(
        user_id=current_user.id,
        target_hotel_id=target_hotel_id,
        rival_hotel_id=rival_hotel_id,
        days=days
    )
    
    if "error" in briefing:
        raise HTTPException(status_code=400, detail=briefing["error"])
        
    target = briefing["target"]
    rival = briefing["rival"]
    metrics = briefing["metrics"]
    narrative = briefing.get("narrative_raw", "No narrative generated.")
    
    html_content = f"""
    <html>
    <head>
        <style>
            @page {{ size: A4; margin: 0; }}
            body {{ 
                font-family: 'Helvetica', sans-serif; 
                background-color: #0a192f; 
                color: #e6f1ff; 
                margin: 0; 
                padding: 40px;
            }}
            .report-wrapper {{ width: 100%; }}
            .header-table {{ width: 100%; border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 40px; }}
            h1 {{ color: #d4af37; margin: 0; font-size: 28px; }}
            .cadence {{ color: #8892b0; font-size: 14px; text-transform: uppercase; }}
            .grid-table {{ width: 100%; border-spacing: 20px 0; }}
            .card {{ 
                background-color: #112240; 
                border: 1px solid #d4af37; 
                border-radius: 12px; 
                padding: 20px; 
                margin-bottom: 20px;
                vertical-align: top;
            }}
            h2 {{ color: #d4af37; font-size: 18px; margin-top: 0; border-left: 3px solid #d4af37; padding-left: 10px; }}
            .metric-table {{ width: 100%; }}
            .metric-val {{ font-weight: bold; color: #fff; font-size: 20px; }}
            .metric-label {{ color: #8892b0; font-size: 12px; }}
            .narrative {{ line-height: 1.6; font-size: 14px; color: #ccd6f6; white-space: pre-line; }}
            .footer {{ 
                margin-top: 50px; 
                text-align: center; 
                color: #8892b0; 
                font-size: 12px; 
                border-top: 1px solid #233554;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="report-wrapper">
            <table class="header-table">
                <tr>
                    <td>
                        <h1>{briefing.get('context', {}).get('report_type', 'Executive Briefing')}</h1>
                        <div class="cadence">{target['name']} | {briefing.get('context', {}).get('timeframe', '30-Day Market Pulse')}</div>
                    </td>
                    <td style="text-align: right; vertical-align: bottom;">
                        <div class="cadence">{datetime.now().strftime('%B %Y')}</div>
                    </td>
                </tr>
            </table>

            <table class="grid-table">
                <tr>
                    <td width="50%">
                        <div class="card" style="background-color: #112240;">
                            <h2 style="color: #d4af37;">Market Battlefield</h2>
                            <table class="metric-table" style="background-color: #112240;">
                                <tr>
                                    <td style="padding: 10px;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{(metrics.get('avg_price') or 0)} {target.get('preferred_currency', 'TRY')}</div>
                                        <div class="metric-label" style="color: #8892b0;">Avg Rate Index (ARI)</div>
                                    </td>
                                    <td style="text-align: right; padding: 10px;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">#{(metrics.get('avg_rank') or 1)}</div>
                                        <div class="metric-label" style="color: #8892b0;">Avg Search Rank</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding: 10px; border-top: 1px solid #233554;">
                                        <div class="metric-val" style="color: #ffffff; font-size: 22px;">{(metrics.get('gri') or 0)}</div>
                                        <div class="metric-label" style="color: #8892b0;">Guest Rating Index (GRI)</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                    <td width="50%">
                        <div class="card" style="background-color: #112240;">
                            <h2 style="color: #d4af37;">The Friction</h2>
                            <div class="metric-val" style="font-size: 22px; color: {'#ff4d4d' if (metrics.get('parity_leaks_count') or 0) > 0 else '#4dff4d'}">
                                {(metrics.get('parity_leaks_count') or 0)} Parity Leaks
                            </div>
                            <div class="metric-label" style="color: #8892b0;">Detected via direct log vs OTA benchmark</div>
                        </div>
                    </td>
                </tr>
            </table>

            {f'''
            <div class="card" style="border-color: #d4af37; background-color: #112240;">
                <h2 style="color: #d4af37;">The Bout: {target['name']} vs {rival['name']}</h2>
                <div class="bout-sim" style="color: #d4af37; font-size: 24px; text-align: center; margin: 20px 0;">{metrics.get('bout_similarity', 0)}% Semantic Similarity</div>
                <div class="metric-label" style="text-align: center; color: #8892b0;">
                    Strategic Alignment Trace: 
                    {str(target.get('pricing_dna', 'Standard'))[:30] if not isinstance(target.get('pricing_dna'), list) else 'Semantic Match'} vs 
                    {str(rival.get('pricing_dna', 'Standard'))[:30] if not isinstance(rival.get('pricing_dna'), list) else 'Semantic Match'}
                </div>
            </div>
            ''' if rival else ""}

            <div class="card" style="background-color: #112240;">
                <h2 style="color: #d4af37;">AI Strategic Narrative</h2>
                <div class="narrative">{narrative}</div>
            </div>

            <div class="footer">
                Intelligence generated by Agentic Tripzy Hub | Powered by Gemini-3-Flash
            </div>
        </div>
    </body>
    </html>
    """
    
    result = io.BytesIO()
    pisa.CreatePDF(html_content, dest=result)
    pdf_bytes = result.getvalue()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=briefing_{target_hotel_id}.pdf"}
    )
