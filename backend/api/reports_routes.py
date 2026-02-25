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
    EXPLANATION: Agentic Briefing Initiation
    This endpoint serves as the bridge between the frontend 'Agentic Briefing' button 
    and the high-reasoning AnalystAgent. It calculates metrics and triggers the 
    Gemini-3-Flash narrative module.
    """
    from backend.agents.analyst_agent import AnalystAgent
    agent = AnalystAgent(db)
    
    briefing = await agent.generate_executive_briefing(
        user_id=current_user.id,
        target_hotel_id=request.target_hotel_id,
        rival_hotel_id=request.rival_hotel_id,
        days=request.days
    )
    
    if "error" in briefing:
        raise HTTPException(status_code=400, detail=briefing["error"])
        
    return briefing

@router.get("/{user_id}")
async def get_reports(user_id: UUID, db: Client = Depends(get_supabase), current_user = Depends(get_current_active_user)):
    """
    EXPLANATION: User Report Management
    Lists all saved reports in the database. Delegation of logic to 'admin_service' 
    ensures that listing rules are consistent across Admin and User views.
    """
    return await get_reports_logic(user_id, db)

@router.post("/{user_id}/export")
async def export_report(user_id: UUID, format: str = "csv", db: Client = Depends(get_supabase)):
    """
    Triggers a data export (CSV/Excel) for a specific user report.
    Delegates generation to admin_service.
    """
    return await export_report_logic(user_id, format, db)

@router.get("/{report_id}/pdf")
async def export_report_pdf(
    report_id: UUID,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Generate and stream a PDF for a specific report.
    """
    try:
        # 1. Fetch Report Data
        report = db.table("reports").select("*").eq("id", str(report_id)).single().execute()
        if not report.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        data = report.data
        report_data = data.get("report_data", {})
        
        # 2. Render HTML Template
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

        # 3. Generate PDF
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"}
        )

@router.get("/briefing/{target_hotel_id}/pdf")
async def export_briefing_pdf(
    target_hotel_id: str,
    rival_hotel_id: Optional[str] = None,
    days: int = 30,
    db: Client = Depends(get_supabase),
    current_user = Depends(get_current_active_user)
):
    """
    EXPLANATION: 'Deep Ocean' Agentic PDF Generation
    This is the signature export for the Agentic Executive Briefing. 
    It leverages the AnalystAgent to regenerate the data (to ensure accuracy) 
    and applies the 'Soft Gold & Deep Ocean' glassmorphism theme.
    """
    from backend.agents.analyst_agent import AnalystAgent
    from weasyprint import HTML
    
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
    
    # Render PDF using the 'Deep Ocean & Soft Gold' Theme
    html_content = f"""
    <html>
    <head>
        <style>
            @page {{ size: A4; margin: 0; }}
            body {{ 
                font-family: 'Inter', 'Helvetica', sans-serif; 
                background: #0a192f; 
                color: #e6f1ff; 
                margin: 0; 
                padding: 40px;
            }}
            .report-wrapper {{ max-width: 800px; margin: auto; }}
            header {{ 
                border-bottom: 2px solid #d4af37; 
                padding-bottom: 20px; 
                margin-bottom: 40px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }}
            h1 {{ color: #d4af37; margin: 0; font-size: 28px; }}
            .cadence {{ color: #8892b0; font-size: 14px; text-transform: uppercase; }}
            
            .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
            .card {{ 
                background: rgba(255, 255, 255, 0.05); 
                border: 1px solid rgba(212, 175, 55, 0.2); 
                border-radius: 12px; 
                padding: 20px; 
                margin-bottom: 20px;
            }}
            h2 {{ color: #d4af37; font-size: 18px; margin-top: 0; border-left: 3px solid #d4af37; padding-left: 10px; }}
            
            .metric-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; }}
            .metric-val {{ font-weight: bold; color: #fff; font-size: 20px; }}
            .metric-label {{ color: #8892b0; font-size: 12px; }}
            
            .narrative {{ line-height: 1.6; white-space: pre-wrap; font-size: 14px; color: #ccd6f6; }}
            .bout-sim {{ font-size: 24px; color: #d4af37; text-align: center; margin: 20px 0; }}
            
            footer {{ 
                margin-top: 50px; 
                text-align: center; 
                color: #8892b0; 
                font-size: 12px; 
                border-top: 1px solid rgba(255,255,255,0.1);
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="report-wrapper">
            <header>
                <div>
                    <h1>Executive Briefing</h1>
                    <div class="cadence">{target['name']} | 30-Day Market Pulse</div>
                </div>
                <div class="cadence">{datetime.now().strftime('%B %Y')}</div>
            </header>

            <div class="grid">
                <div class="card">
                    <h2>Market Battlefield</h2>
                    <div class="metric-row">
                        <div>
                            <div class="metric-val">{metrics['avg_price']} {target.get('preferred_currency', 'TRY')}</div>
                            <div class="metric-label">Avg Rate Index (ARI)</div>
                        </div>
                        <div style="text-align: right">
                            <div class="metric-val">#{metrics['avg_rank']}</div>
                            <div class="metric-label">Avg Search Rank</div>
                        </div>
                    </div>
                    <div class="metric-row">
                         <div>
                            <div class="metric-val">{metrics['gri']}</div>
                            <div class="metric-label">Guest Rating Index (GRI)</div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2>The Friction</h2>
                    <div class="metric-row">
                        <div class="metric-val" style="color: {'#ff4d4d' if metrics['parity_leaks_count'] > 0 else '#4dff4d'}">
                            {metrics['parity_leaks_count']} Parity Leaks
                        </div>
                    </div>
                    <div class="metric-label">Undercuts detected across 30 days</div>
                </div>
            </div>

            {"".join([f'''
            <div class="card" style="border-color: #d4af37;">
                <h2>The Bout: {target['name']} vs {rival['name']}</h2>
                <div class="bout-sim">{metrics['bout_similarity']}% Semantic Similarity</div>
                <div class="metric-label" style="text-align: center;">Strategic Personality: {target.get('pricing_dna', 'Standard')} vs {rival.get('pricing_dna', 'Standard')}</div>
            </div>
            ''' if rival else ""])}

            <div class="card">
                <h2>🤖 AI Strategic Narrative</h2>
                <div class="narrative">{narrative}</div>
            </div>

            <footer>
                Intelligence generated by Agentic Tripzy Hub | Processed via gemini-3-flash-preview
            </footer>
        </div>
    </body>
    </html>
    """
    
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=briefing_{target_hotel_id}.pdf"}
    )
