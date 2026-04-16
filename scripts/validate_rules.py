import os
import re
import sys
import json

def check_tailwind_version():
    pkg_path = "/home/tripzydevops/hotel/package.json"
    if os.path.exists(pkg_path):
        with open(pkg_path, 'r') as f:
            data = json.load(f)
            deps = data.get('devDependencies', {}) or data.get('dependencies', {})
            tw = deps.get('tailwindcss', '')
            if '3.4' not in tw:
                print(f"❌ RULE VIOLATION: Tailwind version must be 3.4. Found: {tw}")
                return False
            else:
                print(f"✅ Tailwind version 3.4 confirmed.")
                return True
    return True

def scan_file_for_violations(filepath):
    violations = []
    with open(filepath, 'r', errors='ignore') as f:
        content = f.read()
        lines = content.splitlines()
        
        for i, line in enumerate(lines):
            # 1. Hardcoded InsForge/Vercel URLs (exclude comments/md)
            if not filepath.endswith('.md') and not line.strip().startswith('#'):
                # Allow specific strings in main.py for CORS/CSP as required by AGENTS.md
                is_manual_cors = 'manual_cors_middleware' in content and (".vercel.app" in line or ".insforge.app" in line)
                is_csp = 'add_security_headers' in line or (i > 0 and 'add_security_headers' in lines[i-1])

                if 'insforge.com' in line.lower() and 'NEXT_PUBLIC_SUPABASE_URL' not in line:
                    violations.append(f"L{i+1}: Potential hardcoded InsForge URL: {line.strip()}")
                
                if 'vercel.app' in line.lower() and not is_manual_cors and not is_csp:
                    violations.append(f"L{i+1}: Potential hardcoded Vercel URL: {line.strip()}")

            # 2. Raw DB client initialization
            if filepath.endswith('.py') and 'supabase.Client()' in line and 'get_supabase' not in line:
                violations.append(f"L{i+1}: Direct supabase.Client() initialization detected. Use get_supabase_client().")

            # 3. Sensitive Key exposure
            if 'SUPABASE_SERVICE_ROLE_KEY' in line and '=' in line and '"' in line:
                violations.append(f"L{i+1}: Potential hardcoded Service Role Key.")
            
            # 4. Error exposure (Python)
            if filepath.endswith('.py') and 'JSONResponse' in line and 'str(exc)' in line and 'global_exception_handler' not in line:
                 violations.append(f"L{i+1}: Potential raw exception exposure in response.")

    return violations

def main():
    print("--- 🛡️ PROJECT COMPLIANCE VALIDATOR ---")
    
    # 1. Check dependencies
    tw_ok = check_tailwind_version()
    
    # 2. Scan modified files (simulated for now, let's scan key service files)
    files_to_scan = [
        "backend/services/providers/dataforseo_provider.py",
        "backend/services/monitor_service.py",
        "backend/api/admin_routes.py",
        "backend/main.py",
        "lib/insforge.ts"
    ]
    
    all_clean = tw_ok
    for f in files_to_scan:
        path = os.path.join("/home/tripzydevops/hotel", f)
        if os.path.exists(path):
            print(f"Scanning {f}...")
            violations = scan_file_for_violations(path)
            if violations:
                all_clean = False
                for v in violations:
                    print(f"  ❌ {v}")
            else:
                print(f"  ✅ No violations found.")
    
    if all_clean:
        print("\n🎉 ALL COMPLIANCE CHECKS PASSED.")
        sys.exit(0)
    else:
        print("\n⚠️ COMPLIANCE CHECK FAILED. Please fix the violations above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
