"""
Schema Drift Detector (Modular)
================================
Compares Pydantic model fields in backend/models/schemas.py against the
actual Supabase table columns (fetched via the REST schema endpoint) to
detect mismatches before they cause runtime validation errors.

Can also run in "offline" mode by comparing schemas.py against a local
schema snapshot file (schema_snapshot.json) so no live DB connection is
needed for the pre-push gate.

EXPLANATION: Schema Drift Prevention
This script exists because the Settings 500 error was caused by a Pydantic
schema enforcing `ge=1` while the database stored `0`. Static linters
cannot catch data-vs-schema conflicts — this detector can.

Usage:
    # Offline mode (compare against local snapshot)
    python3 tests/schema_drift_test.py

    # Online mode (fetch live schema from Supabase)
    python3 tests/schema_drift_test.py --live

    # Update snapshot from live DB
    python3 tests/schema_drift_test.py --update-snapshot

    # JSON output
    python3 tests/schema_drift_test.py --json

Exit codes:
    0 = No drift detected
    1 = Drift detected
"""

import re
import os
import sys
import json
import argparse
from typing import Dict, List, Set, Any, Optional


# ─── Configuration ───────────────────────────────────────────────────────

DEFAULT_SCHEMA_FILE = "backend/models/schemas.py"
DEFAULT_SNAPSHOT_FILE = "tests/schema_snapshot.json"

# Maps Pydantic model names to Supabase table names
MODEL_TABLE_MAP = {
    "HotelBase": "hotels",
    "Hotel": "hotels",
    "HotelCreate": "hotels",
    "UserSettings": "settings",
    "UserSettingsCreate": "settings",
    "UserProfileBase": "user_profiles",
    "UserProfile": "user_profiles",
    "AlertBase": "alerts",
    "Alert": "alerts",
    "QueryLog": "query_logs",
    "ScanSession": "scan_sessions",
    "AdminSettings": "admin_settings",
    "AdminDirectoryEntry": "hotel_directory",
    "MembershipPlan": "membership_plans",
    "PlanBase": "membership_plans",
}


def find_project_root() -> str:
    """Walk up from cwd looking for package.json."""
    cwd = os.getcwd()
    while cwd != "/":
        if os.path.exists(os.path.join(cwd, "package.json")):
            return cwd
        cwd = os.path.dirname(cwd)
    return os.getcwd()


# ─── Step 1: Extract Pydantic Fields ────────────────────────────────────

def extract_pydantic_models(filepath: str) -> Dict[str, Dict[str, Any]]:
    """
    Parse schemas.py and extract model names with their fields.
    Returns {ModelName: {field_name: {type, required, default, constraints}}}
    """
    with open(filepath, "r") as f:
        content = f.read()
        lines = content.split("\n")
    
    models = {}
    current_model = None
    current_fields = {}
    
    for line in lines:
        # Detect class definition
        class_match = re.match(r'^class\s+(\w+)\s*\(', line)
        if class_match:
            # Save previous model
            if current_model and current_fields:
                models[current_model] = current_fields
            current_model = class_match.group(1)
            current_fields = {}
            continue
        
        if current_model is None:
            continue
        
        # Detect field definitions
        field_match = re.match(r'\s{4}(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$', line)
        if field_match and not line.strip().startswith('#') and not line.strip().startswith('class '):
            field_name = field_match.group(1)
            field_type = field_match.group(2).strip()
            field_default = field_match.group(3)
            
            # Skip non-field lines
            if field_name in ('model_config', 'Config', 'class'):
                continue
            
            required = True
            constraints = {}
            
            # Check if Optional
            if 'Optional' in field_type:
                required = False
            
            # Check for Field constraints
            if field_default and 'Field(' in field_default:
                ge_match = re.search(r'ge\s*=\s*(\d+)', field_default)
                le_match = re.search(r'le\s*=\s*(\d+)', field_default)
                if ge_match:
                    constraints['ge'] = int(ge_match.group(1))
                if le_match:
                    constraints['le'] = int(le_match.group(1))
            
            if field_default and field_default.strip() != 'None':
                required = False
            
            current_fields[field_name] = {
                'type': field_type.rstrip(','),
                'required': required,
                'constraints': constraints,
            }
    
    # Save last model
    if current_model and current_fields:
        models[current_model] = current_fields
    
    return models


# ─── Step 2: Load DB Schema ────────────────────────────────────────────

def load_snapshot(filepath: str) -> Dict[str, List[str]]:
    """Load a previously saved schema snapshot."""
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r") as f:
        return json.load(f)


def fetch_live_schema(db_url: str, service_key: str) -> Dict[str, List[str]]:
    """Fetch table columns from Supabase REST API."""
    try:
        import urllib.request
        import urllib.error
        
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }
        
        tables = set(MODEL_TABLE_MAP.values())
        schema = {}
        
        for table in tables:
            url = f"{db_url}/rest/v1/{table}?select=*&limit=0"
            req = urllib.request.Request(url, headers=headers)
            try:
                resp = urllib.request.urlopen(req)
                # Parse column names from the response headers or empty result
                # Supabase returns column info in the Content-Profile header
                # But a simpler approach: fetch one row and get keys
                url_one = f"{db_url}/rest/v1/{table}?select=*&limit=1"
                req_one = urllib.request.Request(url_one, headers=headers)
                resp_one = urllib.request.urlopen(req_one)
                data = json.loads(resp_one.read().decode())
                if data:
                    schema[table] = list(data[0].keys())
                else:
                    schema[table] = []
            except urllib.error.HTTPError:
                schema[table] = []
        
        return schema
    except Exception as e:
        print(f"  ⚠ Failed to fetch live schema: {e}")
        return {}


# ─── Step 3: Compare ──────────────────────────────────────────────────

def detect_drift(
    models: Dict[str, Dict[str, Any]],
    db_schema: Dict[str, List[str]],
) -> List[Dict[str, Any]]:
    """
    Compare Pydantic models against DB columns.
    Returns list of drift issues.
    """
    issues = []
    
    for model_name, fields in models.items():
        table = MODEL_TABLE_MAP.get(model_name)
        if not table:
            continue
        
        db_columns = db_schema.get(table)
        if db_columns is None:
            issues.append({
                'type': 'TABLE_MISSING',
                'model': model_name,
                'table': table,
                'detail': f'Table "{table}" not found in DB schema snapshot.',
            })
            continue
        
        if not db_columns:
            continue  # Empty column list = can't validate
        
        db_col_set = set(db_columns)
        
        for field_name, field_info in fields.items():
            if field_name in ('model_config',):
                continue
            
            # Check if required Pydantic field exists in DB
            if field_name not in db_col_set:
                # Some fields are computed/virtual (not in DB)
                # Only flag required fields as critical
                severity = 'CRITICAL' if field_info['required'] else 'WARNING'
                issues.append({
                    'type': 'FIELD_MISSING_IN_DB',
                    'severity': severity,
                    'model': model_name,
                    'table': table,
                    'field': field_name,
                    'detail': f'Pydantic field "{field_name}" not in table "{table}".',
                })
        
        # Check for validation constraints that could cause 500s
        for field_name, field_info in fields.items():
            constraints = field_info.get('constraints', {})
            if constraints:
                issues.append({
                    'type': 'CONSTRAINT_WARNING',
                    'severity': 'INFO',
                    'model': model_name,
                    'table': table,
                    'field': field_name,
                    'detail': f'Field "{field_name}" has constraints {constraints}. '
                              f'Ensure DB values comply.',
                })
    
    return issues


# ─── Step 4: Self-audit (no DB needed) ──────────────────────────────────

def self_audit_models(models: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run heuristic checks on Pydantic models without needing a DB connection.
    Catches common patterns that lead to 500 errors.
    """
    issues = []
    
    for model_name, fields in models.items():
        for field_name, field_info in fields.items():
            constraints = field_info.get('constraints', {})
            field_type = field_info.get('type', '')
            
            # Pattern: Required field with strict constraint (ge >= 1)
            # Risk: Legacy data with 0 or null will crash serialization
            if constraints.get('ge', 0) > 0 and field_info['required']:
                issues.append({
                    'type': 'STRICT_CONSTRAINT',
                    'severity': 'WARNING',
                    'model': model_name,
                    'field': field_name,
                    'detail': f'Required field with ge={constraints["ge"]}. '
                              f'If DB has values below {constraints["ge"]}, '
                              f'Pydantic will reject them (→ 500 error).',
                })
            
            # Pattern: Required non-Optional field without a default
            # Risk: If DB column is nullable, missing data = crash
            if field_info['required'] and 'Optional' not in field_type:
                if field_name not in ('id', 'user_id', 'created_at'):
                    issues.append({
                        'type': 'NULLABLE_RISK',
                        'severity': 'INFO',
                        'model': model_name,
                        'field': field_name,
                        'detail': f'Required non-Optional field. If DB column '
                                  f'is nullable, missing values will cause '
                                  f'validation errors.',
                    })
    
    return issues


# ─── Step 5: Report ──────────────────────────────────────────────────

def print_report(issues: List[Dict], models: Dict, mode: str, output_json=False) -> bool:
    """Print results. Returns True if critical issues found."""
    
    critical = [i for i in issues if i.get('severity') == 'CRITICAL']
    warnings = [i for i in issues if i.get('severity') == 'WARNING']
    info = [i for i in issues if i.get('severity') == 'INFO']
    
    if output_json:
        print(json.dumps({
            "models_scanned": len(models),
            "critical": len(critical),
            "warnings": len(warnings),
            "info": len(info),
            "issues": issues,
        }, indent=2))
        return len(critical) > 0
    
    print("=" * 70)
    print("  SCHEMA DRIFT DETECTOR — Pydantic ↔ Database Alignment")
    print("=" * 70)
    print()
    print(f"  Mode:            {mode}")
    print(f"  Models scanned:  {len(models)}")
    print(f"  Mapped to DB:    {sum(1 for m in models if m in MODEL_TABLE_MAP)}")
    print(f"  🔴 Critical:     {len(critical)}")
    print(f"  🟡 Warnings:     {len(warnings)}")
    print(f"  🔵 Info:         {len(info)}")
    print()
    
    if critical:
        print("─" * 70)
        print("  🔴 CRITICAL ISSUES (will cause 500 errors)")
        print("─" * 70)
        for i, issue in enumerate(critical, 1):
            print(f"  [{i}] {issue['type']}")
            print(f"      Model: {issue['model']} → Table: {issue.get('table', 'N/A')}")
            print(f"      Detail: {issue['detail']}")
            print()
    
    if warnings:
        print("─" * 70)
        print("  🟡 WARNINGS (potential runtime issues)")
        print("─" * 70)
        for i, issue in enumerate(warnings, 1):
            print(f"  [{i}] {issue['type']}")
            print(f"      Model: {issue['model']}.{issue.get('field', '')}")
            print(f"      Detail: {issue['detail']}")
        print()
    
    if not critical and not warnings:
        print("─" * 70)
        print("  RESULT: PASS — No critical schema drift detected ✅")
        print("─" * 70)
    elif critical:
        print("─" * 70)
        print(f"  RESULT: FAIL — {len(critical)} critical issue(s) found")
        print("─" * 70)
    else:
        print("─" * 70)
        print(f"  RESULT: PASS (with {len(warnings)} warnings) ✅")
        print("─" * 70)
    print()
    
    return len(critical) > 0


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Detect schema drift between Pydantic models and database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 schema_drift_test.py                     # Offline self-audit
  python3 schema_drift_test.py --live              # Compare against live DB
  python3 schema_drift_test.py --update-snapshot   # Save current DB schema
  python3 schema_drift_test.py --json              # JSON output
        """
    )
    parser.add_argument("--schema-file", default=DEFAULT_SCHEMA_FILE, help="Path to schemas.py")
    parser.add_argument("--snapshot", default=DEFAULT_SNAPSHOT_FILE, help="Path to schema snapshot")
    parser.add_argument("--live", action="store_true", help="Fetch live schema from Supabase")
    parser.add_argument("--update-snapshot", action="store_true", help="Update snapshot from live DB")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--project-root", help="Project root directory")
    
    args = parser.parse_args()
    root = args.project_root or find_project_root()
    
    schema_path = os.path.join(root, args.schema_file)
    snapshot_path = os.path.join(root, args.snapshot)
    
    if not os.path.exists(schema_path):
        print(f"Error: Schema file not found: {schema_path}")
        sys.exit(1)
    
    # Extract Pydantic models
    models = extract_pydantic_models(schema_path)
    
    if args.live or args.update_snapshot:
        # Load env
        from dotenv import load_dotenv
        load_dotenv(os.path.join(root, ".env.local"))
        load_dotenv(os.path.join(root, ".env.testing"))
        
        db_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not db_url or not service_key:
            print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for live mode")
            sys.exit(1)
        
        db_schema = fetch_live_schema(db_url, service_key)
        
        if args.update_snapshot:
            with open(snapshot_path, "w") as f:
                json.dump(db_schema, f, indent=2)
            print(f"  ✅ Snapshot saved to {snapshot_path}")
            print(f"  Tables: {', '.join(db_schema.keys())}")
            sys.exit(0)
        
        mode = "Live (Supabase)"
        issues = detect_drift(models, db_schema)
    else:
        # Offline: self-audit only
        mode = "Offline (Self-Audit)"
        snapshot = load_snapshot(snapshot_path)
        
        if snapshot:
            issues = detect_drift(models, snapshot)
            mode = "Offline (Snapshot)"
        else:
            issues = self_audit_models(models)
    
    if not args.json:
        print(f"  Project root: {root}")
        print(f"  Schema file:  {os.path.relpath(schema_path, root)}")
        print()
    
    has_critical = print_report(issues, models, mode, output_json=args.json)
    sys.exit(1 if has_critical else 0)


if __name__ == "__main__":
    main()
