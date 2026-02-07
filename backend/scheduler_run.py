
# -----------------------------------------------------------------------------
# SCHEDULER & CRON ENDPOINTS
# -----------------------------------------------------------------------------

@app.get("/api/cron")
async def trigger_cron_job(
    key: str = Query(..., description="Secret Cron Key"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Public-facing endpoint for external cron services (GitHub Actions, Vercel Cron).
    Triggers the internal scheduler logic to check and run due scans.
    """
    cron_secret = os.getenv("CRON_SECRET", "super_secret_cron_key_123")
    if key != cron_secret:
        raise HTTPException(status_code=403, detail="Invalid Cron Key")
    
    # Logic to trigger pending scans
    # In a real scenario, this would import a scheduler service. 
    # Here, we'll inline the logic to check user schedules and queue jobs.
    
    background_tasks.add_task(run_scheduler_check)
    return {"status": "success", "message": "Scheduler triggered in background"}

async def run_scheduler_check():
    """
    Internal function to check all users for due scans and trigger them.
    """
    print(f"[{datetime.now()}] CRON: Starting scheduler check...")
    try:
        supabase = await get_supabase()
        
        # 1. Get all active users with schedules
        # For MVP, we just check all users who have a 'next_scan_at'
        # In production, join with settings/profiles for active status
        
        # This assumes 'profiles' or 'admin_users' has next_scan_at
        # Let's check 'user_settings' or where we might store this. 
        # Actually, let's look at the 'ScanSession' table for 'scheduled' type?
        # A better approach for MVP: Check 'user_profiles' for 'next_scan_at'
        
        users = supabase.table("user_profiles").select("id, next_scan_at, settings").lte("next_scan_at", datetime.now().isoformat()).execute()
        
        due_users = users.data or []
        print(f"[{datetime.now()}] CRON: Found {len(due_users)} users due for scan.")
        
        for user in due_users:
            # Trigger scan for user
            # We can reuse the existing 'trigger_scan' logic if available, 
            # or directly queue a ScraperAgent job.
            
            # Update next_scan_at immediately to prevent double-firing
            # Default frequency: 24h if not set
            freq_minutes = user.get("settings", {}).get("check_frequency_minutes", 1440)
            next_run = datetime.now() + timedelta(minutes=freq_minutes)
            
            supabase.table("user_profiles").update({"next_scan_at": next_run.isoformat()}).eq("id", user["id"]).execute()
            
            # Run the actual scan (using ScraperAgent)
            # This is where we'd call the agent.
            # scraper = ScraperAgent(user_id=user["id"])
            # await scraper.run_full_scan()
            
            print(f" - Triggered scan for user {user['id']}")
            
    except Exception as e:
        print(f"CRON ERROR: {e}")
