"""
i18n Key Validator (Modular)
=============================
Scans component files for translation key usage and verifies that every 
key exists in all specified dictionary files.

Works with any project using a t("dotted.key") translation function.
Configure via CLI args or a .audit.json config file.

EXPLANATION: i18n Completeness Check
This script exists because the AnalysisTabs were showing raw keys like
"analysis.tabs.overview" instead of labels. The t() function returns the
key string on miss (truthy), so fallback logic `t(key) || fallback` never
triggers. This validator catches missing keys before they hit production.

Usage:
    # Auto-detect
    python3 tests/i18n_validator.py

    # Explicit paths
    python3 tests/i18n_validator.py --components components/ app/ --dicts dictionaries/en.ts dictionaries/tr.ts

    # From config
    python3 tests/i18n_validator.py --config .audit.json

Config (.audit.json):
    {
        "i18n_components": ["components/", "app/"],
        "i18n_dicts": ["dictionaries/en.ts", "dictionaries/tr.ts"],
        "i18n_function": "t"
    }

Exit codes:
    0 = All keys found in all dictionaries
    1 = Missing keys found
"""

import re
import os
import sys
import json
import argparse
from typing import Set

# ─── Configuration ───────────────────────────────────────────────────────

DEFAULT_COMPONENT_DIRS = [
    "components/",
    "app/",
    "src/components/",
    "src/app/",
    "pages/",
    "src/pages/",
]

DEFAULT_DICT_PATTERNS = [
    "dictionaries/*.ts",
    "locales/*.ts",
    "i18n/*.ts",
    "lang/*.ts",
    "locales/*.json",
    "i18n/*.json",
    "public/locales/*/translation.json",
]


def find_project_root() -> str:
    """Walk up from cwd looking for package.json."""
    cwd = os.getcwd()
    while cwd != "/":
        if os.path.exists(os.path.join(cwd, "package.json")):
            return cwd
        cwd = os.path.dirname(cwd)
    return os.getcwd()


def auto_detect_components(root: str) -> list[str]:
    """Find component directories."""
    found = []
    for path in DEFAULT_COMPONENT_DIRS:
        full = os.path.join(root, path)
        if os.path.isdir(full):
            found.append(full)
    return found


def auto_detect_dicts(root: str) -> list[str]:
    """Find dictionary files."""
    import glob
    found = []
    for pattern in DEFAULT_DICT_PATTERNS:
        matches = glob.glob(os.path.join(root, pattern))
        found.extend(matches)
    return sorted(found)


# ─── Step 1: Extract t() Calls ──────────────────────────────────────────

def find_translation_keys(directories: list[str], func_name: str = "t") -> list[dict]:
    """
    Scans source files for translation function calls.
    Returns [{key, file, line}].
    """
    keys_found = []
    
    # Build regex for the translation function
    pattern = re.compile(
        rf"""(?:^|[^a-zA-Z]){re.escape(func_name)}\s*\(\s*['"`]([a-zA-Z0-9_.]+)['"`]\s*\)"""
    )
    
    for directory in directories:
        if not os.path.isdir(directory):
            continue
            
        for root_dir, dirs, files in os.walk(directory):
            dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', 'dist', 'build')]
            
            for filename in files:
                if not filename.endswith(('.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte')):
                    continue
                    
                filepath = os.path.join(root_dir, filename)
                # Get relative path from project root for cleaner output
                try:
                    rel_path = os.path.relpath(filepath)
                except ValueError:
                    rel_path = filepath
                
                with open(filepath, 'r', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for match in pattern.finditer(line):
                            key = match.group(1)
                            if '.' in key and not key.startswith(('e.', 'r.', 'i.')):
                                keys_found.append({
                                    'key': key,
                                    'file': rel_path,
                                    'line': line_num,
                                })
    
    return keys_found


# ─── Step 2: Parse Dictionary Files ──────────────────────────────────────

def extract_dict_keys_ts(filepath: str) -> Set[str]:
    """Parse a TypeScript dictionary file and extract nested keys as dotted paths."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    keys = set()
    path_stack = []
    
    content = re.sub(r'^export\s+(?:const|default)\s+\w+\s*=\s*', '', content, flags=re.MULTILINE)
    
    for line in content.split('\n'):
        stripped = line.strip()
        if not stripped or stripped.startswith('//') or stripped.startswith('/*'):
            continue
        
        open_match = re.match(r'^(\w+)\s*:\s*\{', stripped)
        if open_match:
            path_stack.append(open_match.group(1))
            continue
        
        leaf_match = re.match(r'^(\w+)\s*:', stripped)
        if leaf_match and not stripped.endswith('{'):
            key_name = leaf_match.group(1)
            full_key = '.'.join(path_stack + [key_name])
            keys.add(full_key)
            continue
        
        if stripped.startswith('}'):
            if path_stack:
                path_stack.pop()
            continue
    
    return keys


def extract_dict_keys_json(filepath: str) -> Set[str]:
    """Parse a JSON dictionary file and extract nested keys as dotted paths."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    keys = set()
    
    def _walk(obj, prefix=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                full_key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    _walk(v, full_key)
                else:
                    keys.add(full_key)
    
    _walk(data)
    return keys


def extract_dict_keys(filepath: str) -> Set[str]:
    """Auto-detect format and extract keys."""
    if filepath.endswith('.json'):
        return extract_dict_keys_json(filepath)
    else:
        return extract_dict_keys_ts(filepath)


# ─── Step 3: Validate ────────────────────────────────────────────────────

def validate_keys(used_keys: list[dict], dict_keys: dict[str, Set[str]]) -> dict[str, list]:
    """
    Checks every used key against all dictionaries.
    Returns {dict_name: [missing_items]}.
    """
    unique_keys = {}
    for item in used_keys:
        key = item['key']
        if key not in unique_keys:
            unique_keys[key] = []
        unique_keys[key].append(f"{item['file']}:{item['line']}")
    
    missing = {}
    for dict_name, keys in dict_keys.items():
        missing_in_dict = []
        for key, locations in sorted(unique_keys.items()):
            if key not in keys:
                missing_in_dict.append({'key': key, 'locations': locations})
        missing[dict_name] = missing_in_dict
    
    return missing


# ─── Step 4: Report ──────────────────────────────────────────────────────

def print_report(used_keys, dict_keys, missing, output_json=False):
    unique_used = set(k['key'] for k in used_keys)
    
    if output_json:
        result = {
            "keys_used": len(unique_used),
            "dictionaries": {
                name: {"total_keys": len(keys), "missing": len(missing.get(name, []))}
                for name, keys in dict_keys.items()
            },
            "missing": {
                name: [m["key"] for m in items]
                for name, items in missing.items()
                if items
            },
        }
        print(json.dumps(result, indent=2))
        return bool(any(items for items in missing.values()))
    
    total_missing = sum(len(items) for items in missing.values())
    
    print("=" * 70)
    print("  i18n KEY VALIDATOR — Dictionary Completeness Check")
    print("=" * 70)
    print()
    print(f"  Translation keys used in code:    {len(unique_used)}")
    
    for name, keys in dict_keys.items():
        basename = os.path.basename(name)
        m_count = len(missing.get(name, []))
        icon = "❌" if m_count > 0 else "✅"
        print(f"  {icon} {basename}: {len(keys)} keys, {m_count} missing")
    print()

    for name, items in missing.items():
        if not items:
            continue
        basename = os.path.basename(name)
        print("─" * 70)
        print(f"  ❌ MISSING IN {basename}")
        print("─" * 70)
        for item in items:
            print(f"     Key: {item['key']}")
            for loc in item['locations'][:3]:
                print(f"       ← {loc}")
        print()
    
    if total_missing:
        print("─" * 70)
        print(f"  RESULT: FAIL — {total_missing} missing key(s)")
        print("─" * 70)
    else:
        print("─" * 70)
        print("  RESULT: PASS — All translation keys exist in all dictionaries ✅")
        print("─" * 70)
    
    print()
    return total_missing > 0


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Validate translation keys exist in all dictionary files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 i18n_validator.py                                    # Auto-detect
  python3 i18n_validator.py --components components/ app/      # Explicit dirs
  python3 i18n_validator.py --dicts locales/en.json locales/tr.json
  python3 i18n_validator.py --func-name useTranslation         # Custom function
  python3 i18n_validator.py --json                             # JSON output
        """
    )
    parser.add_argument("--components", "-d", nargs="+", help="Directories to scan for translation usage")
    parser.add_argument("--dicts", nargs="+", help="Dictionary files to validate against")
    parser.add_argument("--func-name", default="t", help="Translation function name (default: t)")
    parser.add_argument("--config", "-c", help="Path to JSON config file")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--project-root", help="Project root directory")
    
    args = parser.parse_args()
    
    root = args.project_root or find_project_root()
    func_name = args.func_name
    
    # Resolve paths
    if args.config:
        config = load_config(args.config)
        comp_dirs = [os.path.join(root, d) for d in config.get("i18n_components", [])]
        dict_files = [os.path.join(root, d) for d in config.get("i18n_dicts", [])]
        func_name = config.get("i18n_function", func_name)
    elif args.components and args.dicts:
        comp_dirs = [os.path.join(root, d) if not os.path.isabs(d) else d for d in args.components]
        dict_files = [os.path.join(root, d) if not os.path.isabs(d) else d for d in args.dicts]
    else:
        comp_dirs = auto_detect_components(root)
        dict_files = auto_detect_dicts(root)
    
    if not comp_dirs:
        print(f"Error: No component directories found. Use --components to specify.")
        sys.exit(1)
    
    if not dict_files:
        print(f"Error: No dictionary files found. Use --dicts to specify.")
        sys.exit(1)
    
    if not args.json:
        print(f"  Project root: {root}")
        print(f"  Scanning:     {', '.join(os.path.relpath(d, root) for d in comp_dirs)}")
        print(f"  Dicts:        {', '.join(os.path.relpath(d, root) for d in dict_files)}")
        print(f"  Function:     {func_name}()")
        print()
    
    # Extract
    used_keys = find_translation_keys(comp_dirs, func_name)
    all_dict_keys = {}
    for df in dict_files:
        all_dict_keys[df] = extract_dict_keys(df)
    
    # Validate
    missing = validate_keys(used_keys, all_dict_keys)
    
    # Report
    has_issues = print_report(used_keys, all_dict_keys, missing, output_json=args.json)
    
    sys.exit(1 if has_issues else 0)


def load_config(config_path: str) -> dict:
    with open(config_path, "r") as f:
        return json.load(f)


if __name__ == "__main__":
    main()
