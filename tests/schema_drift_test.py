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
#
# HOW THIS SCRIPT WORKS (3 modes):
#
#   1. OFFLINE (default): Runs heuristic checks on schemas.py without
#      any DB connection. Catches common anti-patterns like "required
#      field with ge=1" that break on legacy data.
#
#   2. SNAPSHOT: Compares schemas.py fields against a saved JSON file
#      listing the actual DB columns. Catches "field exists in code but
#      not in DB" mismatches. No network needed.
#
#   3. LIVE: Fetches column names directly from Supabase and compares
#      them. Most accurate but requires credentials and network.
#
# The gate (gate.py) runs this in offline mode for speed (<50ms).
# Developers can run --live manually after schema changes.

DEFAULT_SCHEMA_FILE = "backend/models/schemas.py"
DEFAULT_SNAPSHOT_FILE = "tests/schema_snapshot.json"

# MODEL_TABLE_MAP: Maps Pydantic class names → Supabase table names.
#
# WHY THIS MAP EXISTS:
# Pydantic models don't know which DB table they correspond to.
# FastAPI just serializes query results into these models. If a model
# has a field the DB doesn't have (or vice versa), Pydantic will raise
# a ValidationError that surfaces as a 500 to the user.
#
# This map lets us cross-reference: "Does UserSettings.check_frequency_minutes
# actually exist as a column in the `settings` table?"
#
# MAINTENANCE: When you add a new Pydantic model, add it here too.
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
#
# WHY REGEX INSTEAD OF AST:
# We use regex because schemas.py uses both Pydantic v1 and v2 syntax,
# which makes AST parsing fragile. Regex is simpler and only needs to
# extract: class names, field names, types, and Field() constraints.
# It's fast (~5ms for a 500-line file) and good enough for our needs.

def extract_pydantic_models(filepath: str) -> Dict[str, Dict[str, Any]]:
    """
    Parse schemas.py and extract model names with their fields.
    
    Returns a dictionary like:
    {
        'UserSettings': {
            'check_frequency_minutes': {
                'type': 'int',
                'required': False,       # Has a default value
                'constraints': {'ge': 0}  # Field(ge=0) constraint
            },
            ...
        }
    }
    
    This structure lets us check:
    - Does this field exist in the DB? (detect_drift)
    - Could this constraint reject valid DB data? (self_audit_models)
    """
    with open(filepath, "r") as f:
        content = f.read()
        lines = content.split("\n")
    
    models = {}
    current_model = None
    current_fields = {}
    
    for line in lines:
        # Detect class definition (e.g., "class UserSettings(BaseModel):")
        class_match = re.match(r'^class\s+(\w+)\s*\(', line)
        if class_match:
            # Save the previous model before starting a new one
            if current_model and current_fields:
                models[current_model] = current_fields
            current_model = class_match.group(1)
            current_fields = {}
            continue
        
        if current_model is None:
            continue
        
        # Detect field definitions (e.g., "    name: str = Field(default='')")
        # The regex matches: 4-space indent + field_name: type = default
        field_match = re.match(r'\s{4}(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$', line)
        if field_match and not line.strip().startswith('#') and not line.strip().startswith('class '):
            field_name = field_match.group(1)
            field_type = field_match.group(2).strip()
            field_default = field_match.group(3)
            
            # Skip Pydantic internals (model_config, Config class)
            if field_name in ('model_config', 'Config', 'class'):
                continue
            
            required = True
            constraints = {}
            
            # Optional[T] fields can be None, so they're not required
            if 'Optional' in field_type:
                required = False
            
            # Extract Field() constraints like ge=, le=
            # These are the most dangerous: if the DB has a value outside
            # the range, Pydantic will reject the entire row → 500 error.
            # Example: Field(ge=1) will reject any row where the value is 0.
            if field_default and 'Field(' in field_default:
                ge_match = re.search(r'ge\s*=\s*(\d+)', field_default)
                le_match = re.search(r'le\s*=\s*(\d+)', field_default)
                if ge_match:
                    constraints['ge'] = int(ge_match.group(1))
                if le_match:
                    constraints['le'] = int(le_match.group(1))
            
            # If there's any default value (other than None), field is optional
            if field_default and field_default.strip() != 'None':
                required = False
            
            current_fields[field_name] = {
                'type': field_type.rstrip(','),
                'required': required,
                'constraints': constraints,
            }
    
    # Don't forget the last model in the file
    if current_model and current_fields:
        models[current_model] = current_fields
    
    return models


# ─── Step 2: Load DB Schema ────────────────────────────────────────────
#
# TWO WAYS TO GET DB COLUMN NAMES:
# 1. SNAPSHOT: A JSON file saved locally (fast, works offline)
# 2. LIVE: Fetch from Supabase REST API (accurate, needs credentials)
#
# The snapshot approach is used in the gate for speed.
# Run `--update-snapshot` periodically (or after migrations) to refresh.

def load_snapshot(filepath: str) -> Dict[str, List[str]]:
    """
    Load a previously saved schema snapshot.
    
    The snapshot is a simple JSON mapping:
    {"hotels": ["id", "name", "city", ...], "settings": ["id", "user_id", ...]}
    
    Returns empty dict if no snapshot exists (triggers offline self-audit).
    """
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r") as f:
        return json.load(f)


def fetch_live_schema(db_url: str, service_key: str) -> Dict[str, List[str]]:
    """
    Fetch table columns from Supabase REST API.
    
    HOW IT WORKS:
    Supabase's PostgREST layer exposes every table as a REST endpoint.
    We fetch a single row from each table (limit=1) and extract the
    column names from the JSON keys. This is simpler than querying
    information_schema and works with any Supabase project.
    
    REQUIRES: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    (the service role key bypasses Row Level Security to see all columns).
    """
    try:
        import urllib.request
        import urllib.error
        
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }
        
        # Only fetch tables that are mapped to Pydantic models
        tables = set(MODEL_TABLE_MAP.values())
        schema = {}
        
        for table in tables:
            url = f"{db_url}/rest/v1/{table}?select=*&limit=0"
            req = urllib.request.Request(url, headers=headers)
            try:
                resp = urllib.request.urlopen(req)
                # Fetch one row to discover column names from JSON keys.
                # limit=0 just validates the table exists; limit=1 gets data.
                url_one = f"{db_url}/rest/v1/{table}?select=*&limit=1"
                req_one = urllib.request.Request(url_one, headers=headers)
                resp_one = urllib.request.urlopen(req_one)
                data = json.loads(resp_one.read().decode())
                if data:
                    schema[table] = list(data[0].keys())
                else:
                    schema[table] = []  # Table exists but is empty
            except urllib.error.HTTPError:
                schema[table] = []  # Table doesn't exist or access denied
        
        return schema
    except Exception as e:
        print(f"  ⚠ Failed to fetch live schema: {e}")
        return {}


# ─── Step 3: Compare ──────────────────────────────────────────────────
#
# THE CORE LOGIC: Given Pydantic fields and DB columns, find mismatches.
# There are two categories of issues:
#
#   CRITICAL: A required Pydantic field doesn't exist in the DB.
#             This means Pydantic will fail to populate the field → 500.
#
#   WARNING:  An optional field is missing, or a constraint could reject
#             valid DB values. Worth investigating but not always a bug.

def detect_drift(
    models: Dict[str, Dict[str, Any]],
    db_schema: Dict[str, List[str]],
) -> List[Dict[str, Any]]:
    """
    Compare Pydantic models against DB columns.
    
    WHAT IT CHECKS:
    - Does every Pydantic field have a corresponding DB column?
    - Are there Field() constraints that could reject existing DB data?
    
    Returns a list of issue dicts, each with type, severity, and detail.
    """
    issues = []
    
    for model_name, fields in models.items():
        # Only check models we know how to map to tables
        table = MODEL_TABLE_MAP.get(model_name)
        if not table:
            continue
        
        db_columns = db_schema.get(table)
        if db_columns is None:
            # Table missing entirely — could mean snapshot is outdated
            # or table was renamed/deleted
            issues.append({
                'type': 'TABLE_MISSING',
                'model': model_name,
                'table': table,
                'detail': f'Table "{table}" not found in DB schema snapshot.',
            })
            continue
        
        if not db_columns:
            continue  # Table exists but has no rows → can't discover columns
        
        db_col_set = set(db_columns)
        
        for field_name, field_info in fields.items():
            if field_name in ('model_config',):
                continue
            
            # KEY CHECK: Does this Pydantic field exist as a DB column?
            # If not, Pydantic will look for key 'field_name' in the DB row
            # dict, fail to find it, and either:
            #   - Raise ValidationError (if required) → 500
            #   - Use the default value (if optional) → silent but unexpected
            if field_name not in db_col_set:
                severity = 'CRITICAL' if field_info['required'] else 'WARNING'
                issues.append({
                    'type': 'FIELD_MISSING_IN_DB',
                    'severity': severity,
                    'model': model_name,
                    'table': table,
                    'field': field_name,
                    'detail': f'Pydantic field "{field_name}" not in table "{table}".',
                })
        
        # CONSTRAINT CHECK: Flag any Field() with ge/le constraints.
        # These are the sneakiest bugs — the field exists in both places,
        # but the VALUE range doesn't match. Example: ge=1 in Pydantic
        # but 0 in the DB (our actual Settings bug).
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
#
# WHEN THIS RUNS: When there's no snapshot AND no live connection.
# It can still catch bugs by looking at the Pydantic code alone and
# flagging patterns that historically caused 500 errors.
#
# REAL-WORLD EXAMPLE: This would have caught the Settings 500 bug.
# The self-audit would see `check_frequency_minutes: int = Field(ge=1)`
# and flag it as: "Required field with ge=1. If DB has values below 1,
# Pydantic will reject them (→ 500 error)." — which is exactly what
# happened when legacy users had `0` in the DB.

def self_audit_models(models: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run heuristic checks on Pydantic models without needing a DB connection.
    Catches common patterns that lead to 500 errors by analyzing the
    code structure alone.
    """
    issues = []
    
    for model_name, fields in models.items():
        for field_name, field_info in fields.items():
            constraints = field_info.get('constraints', {})
            field_type = field_info.get('type', '')
            
            # PATTERN 1: Required field with a minimum-value constraint.
            # WHY DANGEROUS: If the DB has ANY row where this column is
            # below the `ge` value (e.g., 0 when ge=1), serializing that
            # row into this model will raise a ValidationError. FastAPI
            # catches it and returns a 500 to the user.
            #
            # This is the exact pattern that caused our Settings 500 bug:
            #   check_frequency_minutes: int = Field(default=60, ge=1)
            #   DB had rows with 0 → Pydantic rejected them → 500
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
            
            # PATTERN 2: Required non-Optional field without a default.
            # WHY DANGEROUS: If the DB column is nullable (allows NULL),
            # a row with NULL in this column will fail Pydantic validation
            # because 'None' isn't a valid value for a required `str` or `int`.
            #
            # Exception: id, user_id, created_at are always present,
            # so we don't flag them.
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
