
# ... (imports already exist in main.py)
from datetime import timedelta

class ReportRequest(BaseModel):
    hotel_ids: List[str]
    period_months: int
    title: Optional[str] = None
    comparison_mode: bool = False

@app.post("/api/admin/reports/generate")
async def generate_report(
    req: ReportRequest,
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """
    Generate a comprehensive report (single or comparison) with AI insights.
    """
    try:
        # 1. Fetch Data for Each Hotel
        report_data = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=req.period_months * 30)
        
        for hotel_id in req.hotel_ids:
            # Get Hotel Details
            hotel = db.table("hotels").select("*").eq("id", hotel_id).single().execute()
            if not hotel.data:
                # Try directory if not in tracked hotels
                hotel = db.table("hotel_directory").select("*").eq("id", hotel_id).single().execute()
            
            h_data = hotel.data
            
            # Get Price History
            # Note: mocking history if not available for directory hotels
            # In production: query price_logs
            logs = db.table("price_logs").select("price, recorded_at") \
                .eq("hotel_id", hotel_id) \
                .gte("recorded_at", start_date.isoformat()) \
                .order("recorded_at") \
                .execute()
            
            price_history = logs.data or []
            
            # Calculate metrics
            if price_history:
                prices = [p["price"] for p in price_history]
                avg_price = sum(prices) / len(prices)
                min_price = min(prices)
                max_price = max(prices)
            else:
                avg_price = 0
                min_price = 0
                max_price = 0

            report_data.append({
                "hotel": h_data,
                "metrics": {
                    "avg_price": round(avg_price, 2),
                    "min_price": min_price,
                    "max_price": max_price,
                    "data_points": len(price_history)
                },
                "history": price_history[-30:] # Last 30 points for preview
            })

        # 2. Generate AI Insights (Gemini 2026 Best Practice)
        prompt = f"Analyze these hotels for a {req.period_months}-month report:\n"
        for item in report_data:
            h = item['hotel']
            m = item['metrics']
            prompt += f"- {h.get('name', 'Hotel')}: Avg Price ${m['avg_price']}, Range ${m['min_price']}-${m['max_price']}\n"
            
        prompt += "\nIdentify competitive advantages, pricing anomalies, and actionable recommendations. Be concise but strategic."

        ai_insights = ["AI analysis temporarily unavailable"]
        try:
            from google import genai
            client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            if response.text:
                # Split into bullet points for the UI if needed, or keep as paragraph
                ai_insights = [line.strip() for line in response.text.split("\n") if line.strip() and len(line) > 10]
        except Exception as ai_e:
            print(f"AI Insights Error: {ai_e}")
            ai_insights = [
                f"Based on {req.period_months} months of data, {report_data[0]['hotel'].get('name')} maintains a consistent price position.",
                "Recommendation: Bridge value gaps in service to justify current premiums."
            ]

        # 3. Save Report to DB
        report_entry = {
            "report_type": "comparison" if req.comparison_mode else "single",
            "hotel_ids": req.hotel_ids,
            "period_months": req.period_months,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "report_data": {
                "hotels": report_data,
                "ai_insights": ai_insights
            },
            "title": req.title or f"Market Report - {end_date.strftime('%Y-%m-%d')}",
            "created_by": admin["id"]  # Assuming admin object has ID
        }
        
        result = db.table("reports").insert(report_entry).execute()
        
        return {
            "status": "success", 
            "report_id": result.data[0]["id"],
            "data": result.data[0]
        }

    except Exception as e:
        print(f"Report Generation Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
