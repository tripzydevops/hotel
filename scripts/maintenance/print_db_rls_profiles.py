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

# 1. Print pg_policies for relevant tables
policies = run_query("SELECT schemaname, tablename, policyname, cmd, qual::text, with_check::text FROM pg_policies WHERE tablename IN ('profiles', 'user_profiles');")
print("POLICIES:")
print(policies)

# 2. Check if RLS is enabled
rls_status = run_query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('profiles', 'user_profiles');")
print("\nRLS STATUS:")
print(rls_status)
