import json
import urllib.request
import datetime

# Service Role Key
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8"

NOW = datetime.datetime.now(datetime.timezone.utc)
ONE_HOUR_AGO = (NOW - datetime.timedelta(hours=1)).isoformat()

URL = f"https://ztwkdawfdfbgusskqbns.supabase.co/rest/v1/scan_sessions?select=id,status,created_at&status=eq.running&created_at=lt.{ONE_HOUR_AGO}"

req = urllib.request.Request(URL)
req.add_header("apikey", API_KEY)
req.add_header("Authorization", "Bearer " + API_KEY)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Zombie Sessions (Running > 1h): {len(data)}")
        for s in data[:5]:
            print(f"ID: {s['id']} | Created: {s['created_at']}")
except Exception as e:
    print(f"Error: {e}")
