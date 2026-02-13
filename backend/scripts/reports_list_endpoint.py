
@app.get("/api/admin/reports")
async def get_admin_reports(
    db: Client = Depends(get_supabase),
    admin=Depends(get_current_admin_user)
):
    """List all saved reports."""
    try:
        # Fetch reports sorted by creation date
        result = db.table("reports").select("id, title, report_type, created_at, report_data").order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        print(f"Get Reports Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
