import os

def split_file():
    with open("backend/services/analysis_service.py", "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    core_lines = []
    service_lines = []
    
    # 1. Capture imports for both
    # lines 0-33 are imports
    imports = lines[0:34]
    
    # We add specific imports to analysis_service
    custom_imports = """
from backend.services.analysis_core import (
    get_sentiment_trends,
    _transform_serp_links,
    _extract_price,
    get_price_for_room,
    generate_synthetic_narrative,
    _clean_json_output,
    run_market_intelligence,
    run_heuristic_market_fallback,
    synthesize_pricing_dna,
    generate_strategy_embedding,
    stream_narrative_gen,
    calculate_rate_recommendation,
    generate_audit_checklist,
)
"""
    service_lines.extend(imports)
    service_lines.append(custom_imports)
    
    core_lines.extend(imports)
    
    # The split point: line 688 is `async def perform_market_analysis(`
    # 0-indexed: line 688 is index 687
    # Let's verify where perform_market_analysis starts.
    start_idx = 0
    for i, line in enumerate(lines):
        if line.startswith("async def perform_market_analysis("):
            start_idx = i
            break
            
    core_lines.extend(lines[34:start_idx])
    service_lines.extend(lines[start_idx:])
    
    with open("backend/services/analysis_core.py", "w", encoding="utf-8") as f:
        f.writelines(core_lines)
        
    with open("backend/services/analysis_service.py", "w", encoding="utf-8") as f:
        f.writelines(service_lines)
        
    print(f"Split complete. Core: {len(core_lines)} lines. Service: {len(service_lines)} lines.")

if __name__ == "__main__":
    split_file()
