import os
import re

API_DIR = "backend/api"

MAPPING = {
    "dashboard_routes.py": {
        r'@router\.get\("/dashboard"\)': 'DashboardResponse',
        r'@router\.get\("/global-pulse"\)': 'Dict[str, Any]',
    },
    "pulse_routes.py": {
        r'@router\.get\("/stats"\)': 'GlobalPulseStatsResponse',
    },
    "analysis_routes.py": {
        r'@router\.get\("/v1/discovery/\{hotel_id\}"\)': 'Dict[str, Any]',
        r'@router\.post\("/analysis/market"\)': 'MarketAnalysis',
        r'@router\.get\("/analysis"\)': 'List[HotelWithPrice]',
        r'@router\.post\("/analysis/discovery/\{hotel_id\}"\)': 'SuccessResponse',
        r'@router\.get\("/analysis/\{hotel_id\}/sentiment-history"\)': 'List[Dict[str, Any]]',
        r'@router\.get\("/analysis/debug"\)': 'Dict[str, Any]',
        r'@router\.get\("/v2/analysis/stream"\)': 'None', # StreamingResponse usually no model
        r'@router\.get\("/v1/analysis/intelligence-brief/\{hotel_id\}"\)': 'Dict[str, Any]',
    },
    "alerts_routes.py": {
        r'@router\.patch\("/\{alert_id\}/read"\)': 'SuccessResponse',
        r'@router\.delete\("/user"\)': 'SuccessResponse',
        r'@router\.delete\("/\{alert_id\}"\)': 'SuccessResponse',
    },
    "execution_routes.py": {
        r'@router\.post\("/bridge"\)': 'SuccessResponse',
    },
    "recovery_routes.py": {
        r'@router\.post\("/generate-dispute"\)': 'SuccessResponse',
    },
    "hotel_routes.py": {
        r'@router\.get\("/v1/directory/search"\)': 'List[Dict[str, Any]]',
        r'@router\.get\("/hotels/search"\)': 'List[Hotel]',
        r'@router\.patch\("/hotels/\{hotel_id\}"\)': 'Hotel',
        r'@router\.delete\("/hotels/\{hotel_id\}"\)': 'SuccessResponse',
    },
    "monitor_routes.py": {
        r'@router\.delete\("/logs/\{log_id\}"\)': 'SuccessResponse',
    },
    "market_routes.py": {
        r'@router\.post\("/scrape/tobb"\)': 'SuccessResponse',
        r'@router\.post\("/scrape/tga"\)': 'SuccessResponse',
        r'@router\.post\("/scrape/all"\)': 'SuccessResponse',
        r'@router\.post\("/scrape/clear"\)': 'SuccessResponse',
        r'@router\.get\("/cities"\)': 'CitiesResponse',
        r'@router\.get\("/events"\)': 'List[Dict[str, Any]]',
        r'@router\.get\("/forecast"\)': 'Dict[str, Any]',
    },
    "auth_routes.py": {
        r'@router\.get\("/auth/user", include_in_schema=True\)': 'UserProfile',
        r'@router\.api_route\("/auth", methods=\["GET", "POST", "HEAD"\]\)': 'UserProfile',
        r'@router\.api_route\("/auth/", methods=\["GET", "POST", "HEAD"\]\)': 'UserProfile',
        r'@router\.api_route\("/auth/sync-token", methods=\["GET", "POST", "HEAD"\]\)': 'TokenResponse',
        r'@router\.post\("/auth/refresh"\)': 'TokenResponse',
        r'@router\.get\("/auth/refresh"\)': 'TokenResponse',
        r'@router\.get\("/auth/sessions"\)': 'List[Dict[str, Any]]',
        r'@router\.post\("/auth/sessions"\)': 'SuccessResponse',
        r'@router\.get\("/auth/sessions/current"\)': 'Dict[str, Any]',
        r'@router\.api_route\("/auth/token", methods=\["GET", "POST", "HEAD"\]\)': 'TokenResponse',
    },
    "landing_routes.py": {
        r'@router\.get\("/landing/config"\)': 'Dict[str, Any]',
        r'@router\.get\("/admin/landing/config"\)': 'Dict[str, Any]',
        r'@router\.put\("/admin/landing/config"\)': 'SuccessResponse',
    },
    "admin_routes.py": {
        r'@router\.get\("/debug-providers"\)': 'Dict[str, Any]',
        r'@router\.get\("/providers"\)': 'List[ProviderHealth]',
        r'@router\.patch\("/users/\{user_id\}"\)': 'AdminUser',
        r'@router\.delete\("/users/\{user_id\}"\)': 'SuccessResponse',
        r'@router\.delete\("/directory/\{entry_id\}"\)': 'SuccessResponse',
        r'@router\.put\("/directory/\{entry_id\}"\)': 'SuccessResponse',
        r'@router\.get\("/feed"\)': 'AdminDataResponse',
        r'@router\.get\("/hotels"\)': 'List[Hotel]',
        r'@router\.get\("/scans/\{scan_id\}/export"\)': 'Dict[str, Any]',
        r'@router\.get\("/scans/\{scan_id\}"\)': 'ScanSession',
        r'@router\.put\("/hotels/\{hotel_id\}"\)': 'Hotel',
        r'@router\.delete\("/hotels/\{hotel_id\}"\)': 'SuccessResponse',
        r'@router\.delete\("/plans/\{plan_id\}"\)': 'SuccessResponse',
        r'@router\.get\("/global-settings"\)': 'AdminSettings',
        r'@router\.get\("/settings"\)': 'AdminSettings',
        r'@router\.post\("/global-settings"\)': 'AdminSettings',
        r'@router\.put\("/settings"\)': 'AdminSettings',
        r'@router\.post\("/sync"\)': 'SuccessResponse',
        r'@router\.post\("/sync/profiles"\)': 'SuccessResponse',
        r'@router\.post\("/sync/all"\)': 'SuccessResponse',
        r'@router\.post\("/cleanup-test-data"\)': 'SuccessResponse',
        r'@router\.get\("/market-intelligence"\)': 'Dict[str, Any]',
        r'@router\.get\("/scheduler/queue"\)': 'List[SchedulerQueueEntry]',
        r'@router\.post\("/scheduler/trigger-all"\)': 'SuccessResponse',
        r'@router\.delete\("/scans/cleanup-empty"\)': 'SuccessResponse',
        r'@router\.get\("/batches"\)': 'List[Dict[str, Any]]',
        r'@router\.get\("/batches/\{batch_id\}"\)': 'Dict[str, Any]',
        r'@router\.post\("/tasks/\{task_id\}/rescan"\)': 'SuccessResponse',
        r'@router\.post\("/terminate-impersonation"\)': 'SuccessResponse',
    },
    "reports_routes.py": {
        r'@router\.post\("/briefing"\)': 'ReportsResponse',
        r'@router\.get\("/briefing/\{report_id\}"\)': 'Dict[str, Any]',
        r'@router\.get\("/briefing/saved/\{report_id\}/pdf"\)': 'None',
        r'@router\.get\(""\)': 'ReportsResponse',
        r'@router\.post\("/export"\)': 'SuccessResponse',
        r'@router\.get\("/\{report_id\}/pdf"\)': 'None',
        r'@router\.get\("/briefing/\{target_hotel_id\}/pdf"\)': 'None',
    },
}

for root, _, files in os.walk(API_DIR):
    for file in files:
        if file.endswith(".py") and file in MAPPING:
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            file_mapping = MAPPING[file]

            # Collect models to import
            models_to_import = set()
            for pattern, model in file_mapping.items():
                # Extract the base model names
                if 'List[' in model:
                    base_models = re.findall(r'\[(.*?)\]', model)
                    if base_models:
                        for bm in base_models[0].split(','):
                            bm = bm.strip()
                            if bm not in ['str', 'Any', 'int', 'float', 'bool', 'Dict']:
                                models_to_import.add(bm)
                elif model not in ['None', 'Dict[str, Any]']:
                    models_to_import.add(model)
                    
                # Replace the pattern
                if model == 'None':
                    pass # streaming response, no model needed usually or we skip
                else:
                    def replacer(match):
                        original = match.group(0)
                        if 'response_model' in original: return original
                        
                        # Fix up the match by injecting response_model inside the parens
                        parts = original.split("(")
                        method = parts[0]
                        args = "(".join(parts[1:])
                        # remove trailing ')'
                        args = args[:-1]
                        return f'{method}({args}, response_model={model})'
                    
                    new_content = re.sub(pattern, replacer, new_content)

            # Add imports if missing
            imports_str = ", ".join(models_to_import)
            if models_to_import and "from backend.models.schemas import" in new_content:
                # Find the existing import block
                imp_match = re.search(r'from backend\.models\.schemas import ([^\n]+)', new_content)
                if imp_match:
                    existing_imports = set([x.strip() for x in imp_match.group(1).split(",")])
                    all_imports = existing_imports.union(models_to_import)
                    new_imports_str = ", ".join(sorted(list(all_imports)))
                    new_content = new_content.replace(imp_match.group(0), f'from backend.models.schemas import {new_imports_str}')
            elif models_to_import:
                # Add at the top, after other imports
                new_content = new_content.replace('from fastapi import', f'from backend.models.schemas import {imports_str}\nfrom fastapi import', 1)

            # Standard python typing imports
            if "Any" in new_content and "from typing import" in new_content and "Any" not in new_content.split("from typing import")[1].split("\n")[0]:
                new_content = new_content.replace("from typing import", "from typing import Any, ", 1)
            if "Dict" in new_content and "from typing import" in new_content and "Dict" not in new_content.split("from typing import")[1].split("\n")[0]:
                new_content = new_content.replace("from typing import", "from typing import Dict, ", 1)

            if content != new_content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
