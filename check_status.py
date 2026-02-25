import json
import urllib.request
import datetime

URL = "https://ztwkdawfdfbgusskqbns.supabase.co/rest/v1/scan_sessions?select=status,created_at,completed_at&order=created_at.desc&limit=50"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0d2tkYXdmZGZiZ3Vzc2txYm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDc2MDMsImV4cCI6MjA4NDU4MzYwM30.Hfxoiem3cfBCozK4_liwqS5McLA-EhQDwFb6J5LLqrg"

req = urllib.request.Request(URL)
req.add_header("apikey", API_KEY)
req.add_header("Authorization", "Bearer " + API_KEY)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        total = len(data)
        successes = sum(1 for s in data if s["status"] in ["completed", "partial"])
        failed = sum(1 for s in data if s["status"] == "failed")
        pending = sum(1 for s in data if s["status"] == "running") # Actually 'running' or 'pending'
        
        print(f"Total Sessions (last 50): {total}")
        print(f"Successes (completed/partial): {successes}")
        print(f"Failed: {failed}")
        print(f"Pending/Running: {total - successes - failed}")
        
        # Calculate latency for successes
        latencies = []
        for s in data:
            if s["status"] in ["completed", "partial"] and s.get("created_at") and s.get("completed_at"):
                start = datetime.datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
                end = datetime.datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                latencies.append((end - start).total_seconds())
        
        if latencies:
            avg_latency = sum(latencies) / len(latencies)
            print(f"Avg Latency (Successes): {avg_latency:.2f} s")
        else:
            print("No completed sessions with timestamps found in the last 50.")

except Exception as e:
    print(f"Error: {e}")
