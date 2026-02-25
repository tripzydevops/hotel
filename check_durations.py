import json
import urllib.request
import datetime

URL = "https://ztwkdawfdfbgusskqbns.supabase.co/rest/v1/scan_sessions?select=id,status,created_at,completed_at,hotels_count&order=created_at.desc&limit=10"
# Service Role Key
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8"

req = urllib.request.Request(URL)
req.add_header("apikey", API_KEY)
req.add_header("Authorization", "Bearer " + API_KEY)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for s in data:
            if s.get("created_at") and s.get("completed_at"):
                start = datetime.datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
                end = datetime.datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                duration = (end - start).total_seconds()
                hotels = s.get("hotels_count") or 1
                per_hotel = duration / hotels
                print(f"ID: {s['id']} | Status: {s['status']} | Hotels: {hotels} | Total: {duration:.1f}s | Per Hotel: {per_hotel:.1f}s")
            else:
                print(f"ID: {s['id']} | Status: {s['status']} | Hotels: {s.get('hotels_count')} | Duration: N/A")
except Exception as e:
    print(f"Error: {e}")
