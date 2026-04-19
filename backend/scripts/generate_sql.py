import json

def generate_sql():
    try:
        with open('/home/tripzydevops/hotel/backend/scripts/enrichment_results.json', 'r') as f:
            data = json.load(f)
        
        if not data:
            print("-- No updates to apply")
            return

        values = []
        for r in data:
            # Escape single quotes in names
            resolved_name = r['resolved_location_name'].replace("'", "''")
            values.append(f"('{r['id']}'::uuid, {r['location_code']}, '{resolved_name}')")
            
        sql = "WITH updates (id, loc_code, resolved) AS (VALUES\n"
        sql += ",\n".join(values)
        sql += "\n)\nUPDATE hotel_directory h\nSET location_code = u.loc_code, \n    resolved_location_name = u.resolved,\n    location_verified = true\nFROM updates u\nWHERE h.id = u.id;"
        
        with open('/home/tripzydevops/hotel/backend/scripts/apply_updates.sql', 'w') as f:
            f.write(sql)
        print(f"Generated SQL for {len(data)} updates")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_sql()
