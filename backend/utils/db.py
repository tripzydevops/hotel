# V19_FORCE_SYNC: 2026-03-25T18:28:00Z
import os
from typing import Optional
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from fastapi import Depends

load_dotenv()

def get_supabase_client() -> Optional[Client]:
    # V26: DEEP DIAGNOSTICS
    auth_url = "https://api.insforge.dev"
    rest_url = "https://pa5riyqv.insforge.site"
    key = "ik_4697b4a8df7380fb98a348d2d8c6d163"
    
    import traceback
    try:
        from supabase import create_client, ClientOptions
        # SDK usually expects base URLs, let's try WITHOUT /rest/v1 suffixes first
        opts = ClientOptions(
            postgrest_url=rest_url,
            gotrue_url=auth_url
        )
        client = create_client(rest_url, key, options=opts)
        # Verify connectivity immediately
        try:
            client.table("landing_page_config").select("count").limit(1).execute()
        except Exception as conn_e:
            print(f"[V26] CONNECTION TEST FAILED: {conn_e}")
            # Do NOT return None here yet, might still work for Auth
            
        return client
    except Exception as e:
        print(f"[V26] CRITICAL ALLOCATION FAILURE: {e}")
        print(traceback.format_exc())
        return None

def get_supabase(client: Optional[Client] = Depends(get_supabase_client)):
    if not client:
        from fastapi import HTTPException
        # V26: Expose the failure cause in the HTTP detail for debugging
        raise HTTPException(status_code=500, detail="Database client failed to initialize. Check Vercel logs for Traceback.")
    return client
