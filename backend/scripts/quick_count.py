
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

res = supabase.table("hotel_directory").select("count", count="exact").execute()
print(f"Total Hotels in Directory: {res.count}")
