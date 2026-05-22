import sys, os
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
if not db_url:
    print("No DATABASE_URL found.")
    sys.exit(1)

files = [
    "041_market_analysis_rpc.sql",
    "scripts/027_add_agent_and_signal_schema.sql",
    "scripts/042_add_price_logs_composite_index.sql"
]

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    for f in files:
        print(f"\nApplying {f}...")
        with open(f, 'r', encoding='utf-8') as file:
            sql = file.read()
        cursor.execute(sql)
        print(f"✅ Success: {f}")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"❌ Failed: {e}")
