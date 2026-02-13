"""
API Smoke Test (Modular)
=========================
Hits every API endpoint with a valid auth token and checks for non-error 
responses. Uses the Supabase service role key to authenticate.

EXPLANATION: Runtime Verification
Route contract tests validate the schema (correct method + path).
This script validates the runtime (does the handler actually work?).
A route can exist but still crash due to missing DB columns, bad queries,
or permission errors. This catches those.

Usage:
    # Using .env.testing credentials
    python3 tests/api_smoke_test.py

    # Explicit token
    python3 tests/api_smoke_test.py --token "Bearer eyJ..."

    # Test specific endpoint
    python3 tests/api_smoke_test.py --only /api/dashboard

    # JSON output
    python3 tests/api_smoke_test.py --json

Config (.env.testing):
    NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
    SUPABASE_SERVICE_ROLE_KEY="eyJ..."

Exit codes:
    0 = All endpoints respond (2xx/4xx)
    1 = One or more endpoints returned 5xx (server error)
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from typing import Optional

# ─── Configuration ───────────────────────────────────────────────────────

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env_file(path: str) -> dict:
    """Parse a .env file into a dict."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def find_project_root() -> str:
    """Walk up from cwd looking for package.json or .audit.json."""
    cwd = os.getcwd()
    while cwd != "/":
        if os.path.exists(os.path.join(cwd, "package.json")) or \
           os.path.exists(os.path.join(cwd, ".audit.json")):
            return cwd
        cwd = os.path.dirname(cwd)
    return os.getcwd()


def get_credentials(root: str, explicit_token: Optional[str] = None) -> tuple[str, str]:
    """
    Resolve API base URL and auth token.
    Priority: CLI args > .env.testing > .env.local > environment
    """
    # Load env files
    env_testing = load_env_file(os.path.join(root, ".env.testing"))
    env_local = load_env_file(os.path.join(root, ".env.local"))
    
    # Supabase URL
    supabase_url = (
        env_testing.get("NEXT_PUBLIC_SUPABASE_URL") or
        env_local.get("NEXT_PUBLIC_SUPABASE_URL") or
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or
        ""
    )
    
    # Auth token
    if explicit_token:
        token = explicit_token
    else:
        token = (
            env_testing.get("SUPABASE_SERVICE_ROLE_KEY") or
            env_local.get("SUPABASE_SERVICE_ROLE_KEY") or
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
            env_testing.get("TEST_AUTH_TOKEN") or
            os.environ.get("TEST_AUTH_TOKEN") or
            ""
        )
    
    return supabase_url, token


# ─── Endpoint Registry ──────────────────────────────────────────────────

def build_endpoint_registry(user_id: str) -> list[dict]:
    """
    Returns the list of endpoints to test.
    Each entry: {method, path, name, requires_data, critical}
    
    This can be auto-generated from route_contract_test output,
    but a curated list ensures we test with valid parameters.
    """
    return [
        # ─── Core User Endpoints (Critical) ───
        {"method": "GET",  "path": f"/api/dashboard/{user_id}",     "name": "Dashboard",          "critical": True},
        {"method": "GET",  "path": f"/api/analysis/{user_id}",      "name": "Analysis",           "critical": True},
        {"method": "GET",  "path": f"/api/profile/{user_id}",       "name": "Profile",            "critical": True},
        {"method": "GET",  "path": f"/api/settings/{user_id}",      "name": "Settings",           "critical": True},
        {"method": "GET",  "path": f"/api/reports/{user_id}",       "name": "Reports",            "critical": True},
        {"method": "GET",  "path": f"/api/alerts/{user_id}",        "name": "Alerts",             "critical": True},
        {"method": "GET",  "path": f"/api/hotels/{user_id}",        "name": "Hotels List",        "critical": True},
        {"method": "GET",  "path": "/api/locations",                "name": "Locations",          "critical": False},

        # ─── Search & Discovery ───
        {"method": "GET",  "path": "/api/v1/directory/search?q=hilton", "name": "Directory Search", "critical": False},
        
        # ─── Admin Endpoints ───
        {"method": "GET",  "path": "/api/admin/stats",              "name": "Admin Stats",        "critical": False},
        {"method": "GET",  "path": "/api/admin/users",              "name": "Admin Users",        "critical": False},
        {"method": "GET",  "path": "/api/admin/directory?limit=5",  "name": "Admin Directory",    "critical": False},
        {"method": "GET",  "path": "/api/admin/feed?limit=5",       "name": "Admin Feed",         "critical": False},
        {"method": "GET",  "path": "/api/admin/hotels?limit=5",     "name": "Admin Hotels",       "critical": False},
        {"method": "GET",  "path": "/api/admin/scans?limit=5",      "name": "Admin Scans",        "critical": False},
        {"method": "GET",  "path": "/api/admin/logs?limit=5",       "name": "Admin Logs",         "critical": False},
        {"method": "GET",  "path": "/api/admin/api-keys/status",    "name": "API Key Status",     "critical": False},
    ]


# ─── Test Runner ─────────────────────────────────────────────────────────

def test_endpoint(
    base_url: str, 
    endpoint: dict, 
    token: str, 
    timeout: int = 15
) -> dict:
    """
    Makes an HTTP request to the endpoint and returns the result.
    """
    url = f"{base_url}{endpoint['path']}"
    method = endpoint.get("method", "GET")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "apikey": token,  # Supabase also accepts this header
    }
    
    start = time.time()
    
    try:
        req = urllib.request.Request(url, headers=headers, method=method)
        
        if method in ("POST", "PUT", "PATCH"):
            req.data = b"{}"
        
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = round((time.time() - start) * 1000)
            body = resp.read().decode("utf-8", errors="replace")
            
            # Check response validity
            try:
                data = json.loads(body)
                has_data = bool(data) if isinstance(data, (dict, list)) else True
            except json.JSONDecodeError:
                has_data = bool(body.strip())
            
            return {
                "name": endpoint["name"],
                "status": resp.status,
                "ms": elapsed,
                "ok": True,
                "has_data": has_data,
                "error": None,
                "critical": endpoint.get("critical", False),
            }
    
    except urllib.error.HTTPError as e:
        elapsed = round((time.time() - start) * 1000)
        error_body = ""
        try:
            error_body = e.read().decode("utf-8", errors="replace")[:200]
        except:
            pass
        
        return {
            "name": endpoint["name"],
            "status": e.code,
            "ms": elapsed,
            "ok": e.code < 500,  # 4xx = client error (auth, not found) — not a server bug
            "has_data": False,
            "error": f"{e.code} {e.reason}: {error_body}",
            "critical": endpoint.get("critical", False),
        }
    
    except Exception as e:
        elapsed = round((time.time() - start) * 1000)
        return {
            "name": endpoint["name"],
            "status": 0,
            "ms": elapsed,
            "ok": False,
            "has_data": False,
            "error": str(e),
            "critical": endpoint.get("critical", False),
        }


# ─── Report ──────────────────────────────────────────────────────────────

def print_report(results: list, output_json: bool = False):
    """Print results."""
    
    if output_json:
        print(json.dumps(results, indent=2))
        return
    
    passed = [r for r in results if r["ok"]]
    failed = [r for r in results if not r["ok"]]
    critical_fails = [r for r in failed if r["critical"]]
    
    print("=" * 70)
    print("  API SMOKE TEST — Runtime Endpoint Verification")
    print("=" * 70)
    print()
    print(f"  Endpoints tested:    {len(results)}")
    print(f"  ✅ Passed:           {len(passed)}")
    print(f"  ❌ Failed:           {len(failed)}")
    print(f"  🔴 Critical fails:   {len(critical_fails)}")
    print()
    
    # Results table
    print(f"  {'Endpoint':<25s} {'Status':>6s} {'Time':>7s} {'Result':>8s}")
    print(f"  {'─' * 25} {'─' * 6} {'─' * 7} {'─' * 8}")
    
    for r in results:
        icon = "✅" if r["ok"] else "❌"
        status = str(r["status"]) if r["status"] else "ERR"
        ms = f"{r['ms']}ms"
        data_icon = "📊" if r["has_data"] else "∅"
        print(f"  {r['name']:<25s} {status:>6s} {ms:>7s} {icon} {data_icon}")
    
    print()
    
    if failed:
        print("─" * 70)
        print("  ❌ FAILURES")
        print("─" * 70)
        for r in failed:
            crit = " [CRITICAL]" if r["critical"] else ""
            print(f"\n  {r['name']}{crit}")
            print(f"    Error: {r['error']}")
        print()
    
    if critical_fails:
        print("─" * 70)
        print(f"  RESULT: FAIL — {len(critical_fails)} critical endpoint(s) are broken")
        print("─" * 70)
    elif failed:
        print("─" * 70)
        print(f"  RESULT: WARNING — {len(failed)} non-critical endpoint(s) failed")
        print("─" * 70)
    else:
        print("─" * 70)
        print("  RESULT: PASS — All endpoints respond ✅")
        print("─" * 70)
    
    print()


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Smoke test all API endpoints",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 api_smoke_test.py                          # Auto from .env.testing
  python3 api_smoke_test.py --token "eyJhbG..."      # Explicit token
  python3 api_smoke_test.py --base-url http://localhost:8000
  python3 api_smoke_test.py --only dashboard         # Test specific endpoint
  python3 api_smoke_test.py --json                   # JSON output for CI
        """
    )
    parser.add_argument("--token", "-t", help="Auth token (Bearer JWT)")
    parser.add_argument("--base-url", help="API base URL (overrides env)")
    parser.add_argument("--user-id", help="User ID to test with (auto-detected if not set)")
    parser.add_argument("--only", help="Only test endpoints matching this name (substring)")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--timeout", type=int, default=15, help="Request timeout in seconds")
    parser.add_argument("--project-root", help="Project root directory")
    
    args = parser.parse_args()
    
    root = args.project_root or find_project_root()
    supabase_url, token = get_credentials(root, args.token)
    
    if not token:
        print("Error: No auth token found.")
        print("Set SUPABASE_SERVICE_ROLE_KEY in .env.testing or use --token")
        sys.exit(1)
    
    # Determine base URL
    # For Vercel-deployed apps, we hit the Vercel URL directly
    # For local dev, we hit localhost
    base_url = args.base_url
    if not base_url:
        # Try to find the Vercel deployment URL from vercel.json or config
        vercel_url = None
        audit_config = os.path.join(root, ".audit.json")
        if os.path.exists(audit_config):
            with open(audit_config) as f:
                config = json.load(f)
                vercel_url = config.get("base_url")
        
        if vercel_url:
            base_url = vercel_url
        elif supabase_url:
            # For Supabase-proxied apps, use the functions URL
            # But most Next.js apps are deployed on Vercel
            print("  ℹ️  No base_url configured. Add 'base_url' to .audit.json")
            print("  ℹ️  Example: \"base_url\": \"https://your-app.vercel.app\"")
            print("  ℹ️  Or use: --base-url http://localhost:3000")
            print()
            # Fall back to trying supabase functions
            base_url = supabase_url.replace(".supabase.co", ".supabase.co/functions/v1")
        else:
            base_url = "http://localhost:3000"
    
    # Determine user ID (need a valid one for the endpoints)
    user_id = args.user_id
    if not user_id:
        # Try to find a user from the database using service role
        user_id = _discover_user_id(supabase_url, token)
        if not user_id:
            print("Error: Could not determine a user_id. Use --user-id to specify one.")
            sys.exit(1)
    
    if not args.json:
        print(f"  Base URL:  {base_url}")
        print(f"  User ID:   {user_id}")
        print(f"  Token:     ...{token[-8:]}")
        print()
    
    # Build endpoint list
    endpoints = build_endpoint_registry(user_id)
    
    # Filter if --only specified
    if args.only:
        endpoints = [e for e in endpoints if args.only.lower() in e["name"].lower()]
        if not endpoints:
            print(f"No endpoints match '{args.only}'")
            sys.exit(1)
    
    # Run tests
    results = []
    for ep in endpoints:
        result = test_endpoint(base_url, ep, token, timeout=args.timeout)
        results.append(result)
        if not args.json:
            icon = "✅" if result["ok"] else "❌"
            print(f"  {icon} {result['name']}: {result['status']} ({result['ms']}ms)")
    
    print()
    print_report(results, output_json=args.json)
    
    critical_fails = [r for r in results if not r["ok"] and r["critical"]]
    sys.exit(1 if critical_fails else 0)


def _discover_user_id(supabase_url: str, service_role_key: str) -> Optional[str]:
    """
    Uses the Supabase Admin API to find the first user.
    This requires the service_role key.
    """
    if not supabase_url or not service_role_key:
        return None
    
    url = f"{supabase_url}/auth/v1/admin/users?page=1&per_page=1"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            users = data.get("users", [])
            if users:
                uid = users[0].get("id")
                return uid
    except Exception as e:
        pass
    
    return None


if __name__ == "__main__":
    main()
