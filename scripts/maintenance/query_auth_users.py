import subprocess
import json

def run_query(sql):
    res = subprocess.run(
        ["npx", "-y", "@insforge/cli", "db", "query", sql, "--json"],
        capture_output=True, text=True
    )
    if res.returncode == 0:
        try:
            lines = res.stdout.strip().split("\n")
            json_str = ""
            for line in lines:
                if line.startswith("{") or line.startswith("["):
                    json_str += line
            if json_str:
                return json.loads(json_str)
            return res.stdout
        except Exception as e:
            return f"Parse error: {e}. Output was: {res.stdout}"
    else:
        return "ERROR: " + res.stderr

users = run_query("SELECT id, email FROM auth.users WHERE email = 'tripzydevops@gmail.com';")
print("Auth User:", users)
