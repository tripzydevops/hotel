from supabase import create_client
import json
import subprocess
import re

SOURCE_URL = 'https://ztwkdawfdfbgusskqbns.supabase.co'
SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8'

source = create_client(SOURCE_URL, SOURCE_KEY)

TABLE_MAP = {
    'location_registry': 'location_registry',
    'plans': 'membership_plans',
    'profiles': 'profiles',
    'user_profiles': 'user_profiles',
    'settings': 'settings',
    'hotels': 'hotels',
    'hotel_directory': 'hotel_directory',
    'price_logs': 'price_logs',
    'query_logs': 'query_logs',
    'scan_sessions': 'scan_sessions',
    'alerts': 'alerts',
    'admin_settings': 'admin_settings',
    'market_events': 'market_events',
    'sentiment_history': 'sentiment_history'
}

def verify():
    print(f"{'Table':<20} | {'Source':<10} | {'Target':<10} | {'Status':<10}")
    print("-" * 60)
    for src, dest in TABLE_MAP.items():
        try:
            # Source count
            s_res = source.table(src).select('*', count='exact').limit(0).execute()
            s_count = s_res.count
            
            # Target count
            cmd = ["npx", "@insforge/cli", "db", "query", f"SELECT count(*) FROM {dest}"]
            t_res = subprocess.run(cmd, capture_output=True, text=True)
            
            t_count = 0
            lines = t_res.stdout.split('\n')
            for line in lines:
                if '│' in line and 'count' not in line:
                    # Strip ANSI color codes
                    clean_line = re.sub(r'\x1b\[[0-9;]*m', '', line)
                    parts = [p.strip() for p in clean_line.split('│') if p.strip()]
                    if parts:
                        try:
                            t_count = int(parts[0])
                            break
                        except ValueError:
                            continue
            
            status = "✓ OK" if s_count == t_count else "X DIFF"
            print(f"{dest:<20} | {s_count:<10} | {t_count:<10} | {status}")
        except Exception as e:
            print(f"{dest:<20} | ERROR: {e}")

if __name__ == "__main__":
    verify()
