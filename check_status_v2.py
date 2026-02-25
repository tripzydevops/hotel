import json
import urllib.request
import datetime

URL = "https://ztwkdawfdfbgusskqbns.supabase.co/rest/v1/scan_sessions?select=status,created_at,completed_at&order=created_at.desc&limit=50"
# Service Role Key
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNzYwMywiZXhwIjoyMDg0NTgzNjAzfQ.fK1BbznvceMo-YbntB_FCJs49mant-CRiKPny5i21s8"

req = urllib.request.Request(URL)
req.add_header("apikey", API_KEY)
req.add_header("Authorization", "Bearer " + API_KEY)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        total = len(data)
        if total == 0:
            print("No sessions found even with Service Role Key.")
        else:
            successes = sum(1 for s in data if s["status"] in ["completed", "partial"])
            failed = sum(1 for s in data if s["status"] == "failed")
            
            print(f"Total Sessions (last 50): {total}")
            print(f"Successes (completed/partial): {successes}")
            print(f"Failed: {failed}")
            print(f"Other (running/pending): {total - successes - failed}")
            
            latencies = []
            for s in data:
                if s["status"] in ["completed", "partial"] and s.get("created_at") and s.get("completed_at"):
                    start = datetime.datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
                    end = datetime.datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                    latencies.append((end - start).total_seconds())
            
            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                print(f"Avg Latency (Successes): {avg_latency:.2f} s")
                print(f"Max Latency: {max(latencies):.2f} s")
                print(f"Min Latency: {min(latencies):.2f} s")

except Exception as e:
    print(f"Error: {e}")
