from supabase import create_client
import json
import subprocess
import os
import time
import re

SOURCE_URL = 'https://ztwkdawfdfbgusskqbns.supabase.co'
SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8'

source = create_client(SOURCE_URL, SOURCE_KEY)

# Tables to migrate. 
TABLE_MAP = {
    'location_registry': 'location_registry',
    'plans': 'membership_plans', # Map Supabase 'plans' to InsForge 'membership_plans'
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

def get_clean_target_cols(table_name):
    cmd = ["npx", "@insforge/cli", "db", "query", f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'public'"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    # Extract column names from ASCII table output
    lines = res.stdout.split('\n')
    cols = []
    for line in lines:
        if '│' in line and 'column_name' not in line:
            # Clean ANSI codes and whitespace
            name = re.sub(r'\x1b\[[0-9;]*m', '', line).strip('│ ').strip()
            if name: cols.append(name)
    return cols

def format_sql_value(v, col_name):
    if v is None:
        return 'NULL'
    if isinstance(v, (dict, list)):
        if col_name in ['embedding', 'pricing_dna', 'sentiment_embedding']:
            return f"'{json.dumps(v)}'"
        s = json.dumps(v).replace("'", "''")
        return f"'{s}'"
    if isinstance(v, str):
        s = v.replace("'", "''")
        return f"'{s}'"
    return str(v)

def migrate_table(src_table, dest_table):
    print(f"\n>>>> MIGRATING: {src_table} -> {dest_table} <<<<")
    try:
        # 1. Get clean target columns
        target_cols = get_clean_target_cols(dest_table)
        print(f"  Target columns: {target_cols}")

        # 2. Get 1 source row to see source columns
        sample = source.table(src_table).select('*').limit(1).execute().data
        source_cols = list(sample[0].keys()) if sample else []
        
        common_cols = [c for c in source_cols if c in target_cols]
        print(f"  Common columns to migrate: {common_cols}")
        
        if not common_cols:
            print("  !! No common columns found. Skipping.")
            return

        # 3. Truncate target
        print(f"  Truncating {dest_table}...")
        subprocess.run(["npx", "@insforge/cli", "db", "query", f"TRUNCATE {dest_table} CASCADE;"], capture_output=True)

        # 4. Get count for pagination
        res = source.table(src_table).select('*', count='exact').limit(0).execute()
        total = res.count
        print(f"  Total source rows: {total}")
        if total == 0: return

        # 5. Bulk Export/Import
        batch_size = 300
        for offset in range(0, total, batch_size):
            end = min(offset + batch_size, total)
            print(f"  Processing {offset} to {end}...")
            
            data = source.table(src_table).select('*').range(offset, end - 1).execute().data
            if not data: break

            sql_file = f"/tmp/final_batch_{dest_table}_{offset}.sql"
            with open(sql_file, "w") as f:
                cols_str = ", ".join(common_cols)
                f.write(f"INSERT INTO {dest_table} ({cols_str}) VALUES \n")
                
                rows_vals = []
                for row in data:
                    vals = [format_sql_value(row[c], c) for c in common_cols]
                    rows_vals.append("(" + ", ".join(vals) + ")")
                f.write(",\n".join(rows_vals))
                f.write(";")

            # Import to InsForge
            res = subprocess.run(["npx", "@insforge/cli", "db", "import", sql_file], capture_output=True, text=True)
            if res.returncode == 0:
                print(f"  ✓ Chunk {offset} OK")
            else:
                print(f"  X Chunk {offset} FAIL: {res.stderr.strip()[:100]}")
            
            os.remove(sql_file)
            time.sleep(0.05)
            
    except Exception as e:
        print(f"  !! Fatal Error: {e}")

if __name__ == "__main__":
    for src, dest in TABLE_MAP.items():
        migrate_table(src, dest)
    print("\n--- DEFINITIVE MIGRATION COMPLETE ---")
