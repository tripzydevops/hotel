import json
import urllib.request

# Service Role Key
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8"

URL = "https://ztwkdawfdfbgusskqbns.supabase.co/rest/v1/scan_sessions?select=id,reasoning_trace&status=eq.failed&limit=3&order=created_at.desc"

req = urllib.request.Request(URL)
req.add_header("apikey", API_KEY)
req.add_header("Authorization", "Bearer " + API_KEY)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for s in data:
            print(f"--- Session {s['id']} ---")
            trace = s.get("reasoning_trace")
            if isinstance(trace, list):
                for t in trace:
                    print(t)
            else:
                print(f"Trace: {trace}")
except Exception as e:
    print(f"Error: {e}")
