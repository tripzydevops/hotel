"""
Database Pruning Script for scan_sessions table.

This script is designed to run automatically via a daily cron job.
Its purpose is to locate and permanently delete old "Thought Traces" and 
raw scraping data from the Supabase database to prevent storage bloat.

Retention Policy: 30 Days.
Any scan session older than 30 days is considered obsolete, as the 
final analyzed metrics have already been stored in permanent tables.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

# Add project root to path so we can import internal backend packages
sys.path.append(os.getcwd())

from dotenv import load_dotenv
load_dotenv()

from backend.utils.db import get_supabase

def prune_scan_sessions():
    """
    Connects to Supabase, calculates a 30-day cutoff, and issues a 
    bulk delete command for the `scan_sessions` table.
    """
    supabase = get_supabase()
    
    # Calculate cutoff date: Current UTC Time minus 30 days
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    print(f"[Pruning] Finding scan_sessions older than {cutoff_date}...")
    
    try:
        # Execute the deletion
        # .lt() filters for rows where 'created_at' is Less Than the cutoff date
        response = supabase.table("scan_sessions").delete().lt("created_at", cutoff_date).execute()
        
        # Log the number of rows successfully removed from the database
        deleted_count = len(response.data) if response.data is not None else "Unknown number of"
        print(f"[Pruning] Successfully deleted {deleted_count} old scan sessions.")
    except Exception as e:
        print(f"[Pruning] Error during deletion: {e}")

if __name__ == "__main__":
    prune_scan_sessions()
