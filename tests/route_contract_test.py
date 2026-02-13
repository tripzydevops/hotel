"""
Route Contract Test (Modular)
==============================
Validates that every API call in a frontend API client file has a matching 
backend route with the correct HTTP method and path.

Works with any Next.js + FastAPI (or similar) project. Configure via CLI 
args or a .audit.json config file.

EXPLANATION: Route Mismatch Prevention
This script exists because the #1 cause of "N/A" / "No Data" bugs was
the frontend calling GET /api/analysis/{userId} while the backend only
had POST /api/analysis/market/{user_id}. Static analysis (lint, tsc) 
cannot catch this class of bug — only a cross-file contract check can.

Usage:
    # Auto-detect (looks for lib/api.ts + backend/api/ in current dir)
    python3 tests/route_contract_test.py

    # Explicit paths
    python3 tests/route_contract_test.py --frontend lib/api.ts --backend backend/api/

    # From config file
    python3 tests/route_contract_test.py --config .audit.json

Config (.audit.json):
    {
        "frontend_api": "lib/api.ts",
        "backend_api_dir": "backend/api/",
        "api_prefix": "/api"
    }

Exit codes:
    0 = All routes match
    1 = Mismatches found
"""

import re
import os
import sys
import json
import argparse

# ─── Configuration ───────────────────────────────────────────────────────

DEFAULT_FRONTEND_PATHS = [
    "lib/api.ts",
    "src/lib/api.ts",
    "src/api.ts",
    "services/api.ts",
    "src/services/api.ts",
]

DEFAULT_BACKEND_DIRS = [
    "backend/api/",
    "api/",
    "app/api/",
    "src/api/",
    "server/api/",
]


def find_project_root() -> str:
    """Walk up from cwd looking for package.json (Next.js) or requirements.txt."""
    cwd = os.getcwd()
    while cwd != "/":
        if os.path.exists(os.path.join(cwd, "package.json")) or \
           os.path.exists(os.path.join(cwd, "requirements.txt")):
            return cwd
        cwd = os.path.dirname(cwd)
    return os.getcwd()


def auto_detect_paths(root: str) -> tuple:
    """Auto-detect frontend API file and backend API directory."""
    frontend = None
    backend = None
    
    for path in DEFAULT_FRONTEND_PATHS:
        full = os.path.join(root, path)
        if os.path.exists(full):
            frontend = full
            break
    
    for path in DEFAULT_BACKEND_DIRS:
        full = os.path.join(root, path)
        if os.path.isdir(full):
            backend = full
            break
    
    return frontend, backend


def load_config(config_path: str) -> dict:
    """Load configuration from a JSON file."""
    with open(config_path, "r") as f:
        return json.load(f)


# ─── Step 1: Extract Frontend API Calls ──────────────────────────────────

def extract_frontend_calls(filepath: str) -> list[dict]:
    """
    Parses a TypeScript API client file and extracts all API endpoint calls.
    Returns a list of {method, path, function_name, line_number}.
    
    Supports patterns:
      - this.fetch<T>(`/api/...`)          → GET (default)
      - this.fetch<T>(`/api/...`, {method: "POST"})  → POST
      - fetch(`${BASE}/api/...`, {method: "POST"})   → POST
    """
    with open(filepath, "r") as f:
        content = f.read()
        lines = content.split("\n")

    calls = []
    current_function = "unknown"
    
    for i, line in enumerate(lines, 1):
        # Track function context
        func_match = re.match(r'\s+(?:async\s+)?(\w+)\s*\(', line)
        if func_match and func_match.group(1) not in ("fetch", "if", "for", "while", "catch"):
            current_function = func_match.group(1)
        
        # Match fetch calls with template literals containing /api/
        fetch_match = re.search(r'(?:this\.fetch\S*|fetch)\s*\(\s*`[^`]*(/api/[^`]*)`', line)
        if not fetch_match:
            fetch_match = re.search(r'`\$\{[^}]+\}(/api/[^`]+)`', line)
        
        if fetch_match:
            raw_path = fetch_match.group(1)
            
            # Clean path: remove query params and ${} interpolations
            path = re.sub(r'\?.*$', '', raw_path)
            path = re.sub(r'\$\{[^}]+\}', '{param}', path)
            
            # Remove trailing {param} that are just query string artifacts
            path = path.rstrip('/')
            
            # Determine HTTP method (check current and next 5 lines)
            method = "GET"
            context = "\n".join(lines[i-1:min(i+5, len(lines))])
            method_match = re.search(r'method:\s*["\'](\w+)["\']', context)
            if method_match:
                method = method_match.group(1).upper()
            
            calls.append({
                "method": method,
                "path": path,
                "function": current_function,
                "line": i,
            })
    
    return calls


# ─── Step 2: Extract Backend Routes ──────────────────────────────────────

def extract_backend_routes(api_dir: str) -> list[dict]:
    """
    Parses all Python route files and extracts route decorators.
    Returns a list of {method, path, normalized, file, line_number}.
    
    Supports:
      - @router.get("/path")
      - @app.get("/path")
      - @bp.route("/path", methods=["GET"])  (Flask)
    """
    routes = []
    
    for filename in sorted(os.listdir(api_dir)):
        if not filename.endswith(".py") or filename.startswith("__"):
            continue
            
        filepath = os.path.join(api_dir, filename)
        with open(filepath, "r") as f:
            lines = f.readlines()
        
        # Find router prefix
        prefix = ""
        for line in lines:
            prefix_match = re.search(r'(?:APIRouter|Router)\s*\(\s*prefix\s*=\s*"([^"]*)"', line)
            if prefix_match:
                prefix = prefix_match.group(1)
                break
        
        # Find route decorators (FastAPI style)
        for i, line in enumerate(lines, 1):
            route_match = re.search(
                r'@(?:router|app|bp)\.(get|post|put|patch|delete)\s*\(\s*"([^"]*)"', 
                line
            )
            if route_match:
                method = route_match.group(1).upper()
                route_path = route_match.group(2)
                full_path = prefix + route_path
                normalized = re.sub(r'\{[^}]+\}', '{param}', full_path)
                
                routes.append({
                    "method": method,
                    "path": full_path,
                    "normalized": normalized,
                    "file": filename,
                    "line": i,
                })
            
            # Flask-style routes
            flask_match = re.search(
                r'@(?:app|bp)\.route\s*\(\s*"([^"]*)".*methods\s*=\s*\[([^\]]*)\]', 
                line
            )
            if flask_match:
                route_path = flask_match.group(1)
                methods = re.findall(r'"(\w+)"', flask_match.group(2))
                full_path = prefix + route_path
                normalized = re.sub(r'\{[^}]+\}', '{param}', full_path)
                normalized = re.sub(r'<[^>]+>', '{param}', normalized)  # Flask <param>
                
                for method in methods:
                    routes.append({
                        "method": method.upper(),
                        "path": full_path,
                        "normalized": normalized,
                        "file": filename,
                        "line": i,
                    })
    
    return routes


# ─── Step 3: Cross-Reference ─────────────────────────────────────────────

def validate_contracts(frontend_calls: list, backend_routes: list) -> tuple[list, list]:
    """
    Checks every frontend call against backend routes.
    Returns (matches, mismatches).
    """
    backend_lookup = {}
    for route in backend_routes:
        key = (route["method"], route["normalized"])
        backend_lookup[key] = route
    
    matches = []
    mismatches = []
    
    for call in frontend_calls:
        key = (call["method"], call["path"])
        
        if key in backend_lookup:
            matches.append({"frontend": call, "backend": backend_lookup[key]})
        else:
            path_exists = [r for r in backend_routes if r["normalized"] == call["path"]]
            
            mismatch = {"frontend": call, "backend_candidates": path_exists}
            
            if path_exists:
                mismatch["type"] = "METHOD_MISMATCH"
                mismatch["detail"] = (
                    f"Frontend sends {call['method']} but backend expects "
                    f"{', '.join(set(r['method'] for r in path_exists))}"
                )
            else:
                mismatch["type"] = "ROUTE_MISSING"
                mismatch["detail"] = f"No backend route matches {call['method']} {call['path']}"
            
            mismatches.append(mismatch)
    
    return matches, mismatches


# ─── Step 4: Report ──────────────────────────────────────────────────────

def print_report(matches, mismatches, frontend_calls, backend_routes, output_json=False):
    """Pretty-prints or JSON-outputs the results."""
    
    if output_json:
        result = {
            "frontend_calls": len(frontend_calls),
            "backend_routes": len(backend_routes),
            "matched": len(matches),
            "mismatched": len(mismatches),
            "mismatches": [
                {
                    "type": m["type"],
                    "method": m["frontend"]["method"],
                    "path": m["frontend"]["path"],
                    "function": m["frontend"]["function"],
                    "line": m["frontend"]["line"],
                    "detail": m["detail"],
                }
                for m in mismatches
            ],
        }
        print(json.dumps(result, indent=2))
        return
    
    print("=" * 70)
    print("  ROUTE CONTRACT TEST — Frontend ↔ Backend Alignment")
    print("=" * 70)
    print()
    print(f"  Frontend API calls:  {len(frontend_calls)}")
    print(f"  Backend routes:      {len(backend_routes)}")
    print(f"  ✅ Matched:          {len(matches)}")
    print(f"  ❌ Mismatched:       {len(mismatches)}")
    print()
    
    if mismatches:
        print("─" * 70)
        print("  ❌ MISMATCHES FOUND")
        print("─" * 70)
        
        for i, m in enumerate(mismatches, 1):
            fe = m["frontend"]
            print(f"\n  [{i}] {m['type']}")
            print(f"      Frontend: {fe['method']} {fe['path']}")
            print(f"      Function: {fe['function']}() at line {fe['line']}")
            print(f"      Detail:   {m['detail']}")
            
            if m.get("backend_candidates"):
                for c in m["backend_candidates"]:
                    print(f"      Backend:  {c['method']} {c['path']} ({c['file']}:{c['line']})")
        
        print(f"\n{'─' * 70}")
        print(f"  RESULT: FAIL — {len(mismatches)} route(s) need fixing")
        print("─" * 70)
    else:
        print("─" * 70)
        print("  RESULT: PASS — All frontend calls have matching backend routes ✅")
        print("─" * 70)
    
    if matches:
        print(f"\n  ✅ Matched Routes:")
        for m in matches:
            fe = m["frontend"]
            be = m["backend"]
            print(f"      {fe['method']:6s} {fe['path']:45s} ← {be['file']}:{be['line']}")
    print()


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Validate frontend API calls match backend routes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 route_contract_test.py                          # Auto-detect
  python3 route_contract_test.py --frontend lib/api.ts    # Explicit frontend
  python3 route_contract_test.py --config .audit.json     # From config
  python3 route_contract_test.py --json                   # JSON output
        """
    )
    parser.add_argument("--frontend", "-f", help="Path to frontend API client file (e.g., lib/api.ts)")
    parser.add_argument("--backend", "-b", help="Path to backend API routes directory (e.g., backend/api/)")
    parser.add_argument("--config", "-c", help="Path to JSON config file")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--project-root", help="Project root directory (auto-detected by default)")
    
    args = parser.parse_args()
    
    # Resolve project root
    root = args.project_root or find_project_root()
    
    # Load from config if provided
    if args.config:
        config = load_config(args.config)
        frontend_path = os.path.join(root, config.get("frontend_api", ""))
        backend_dir = os.path.join(root, config.get("backend_api_dir", ""))
    elif args.frontend and args.backend:
        frontend_path = os.path.join(root, args.frontend) if not os.path.isabs(args.frontend) else args.frontend
        backend_dir = os.path.join(root, args.backend) if not os.path.isabs(args.backend) else args.backend
    else:
        frontend_path, backend_dir = auto_detect_paths(root)
    
    if not frontend_path or not os.path.exists(frontend_path):
        print(f"Error: Cannot find frontend API file. Tried: {DEFAULT_FRONTEND_PATHS}")
        print(f"Use --frontend to specify the path explicitly.")
        sys.exit(1)
    
    if not backend_dir or not os.path.isdir(backend_dir):
        print(f"Error: Cannot find backend API directory. Tried: {DEFAULT_BACKEND_DIRS}")
        print(f"Use --backend to specify the path explicitly.")
        sys.exit(1)
    
    if not args.json:
        print(f"  Project root: {root}")
        print(f"  Frontend:     {os.path.relpath(frontend_path, root)}")
        print(f"  Backend:      {os.path.relpath(backend_dir, root)}")
        print()
    
    frontend_calls = extract_frontend_calls(frontend_path)
    backend_routes = extract_backend_routes(backend_dir)
    matches, mismatches = validate_contracts(frontend_calls, backend_routes)
    print_report(matches, mismatches, frontend_calls, backend_routes, output_json=args.json)
    
    sys.exit(1 if mismatches else 0)


if __name__ == "__main__":
    main()
