import os
import re

def fix_ts():
    # 1. Fix HotelTile.tsx t() calls
    ht_path = "components/tiles/HotelTile.tsx"
    if os.path.exists(ht_path):
        with open(ht_path, 'r', encoding='utf-8') as f:
            ht = f.read()
        # Replace t("key", "fallback") with t("key")
        ht = re.sub(r't\("([^"]+)",\s*"[^"]+"\)', r't("\1")', ht)
        with open(ht_path, 'w', encoding='utf-8') as f:
            f.write(ht)

    # 2. Add imports to TargetHotelTile, CompetitorTile, ScoreCard, and sentiment/page.tsx
    files_to_import = [
        "components/tiles/TargetHotelTile.tsx",
        "components/tiles/CompetitorTile.tsx",
        "components/ui/sentiment/ScoreCard.tsx",
        "app/(dashboard)/analysis/sentiment/page.tsx"
    ]
    
    for fname in files_to_import:
        if not os.path.exists(fname): continue
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Add imports if missing
        import_stmt = 'import { HotelWithPrice, GuestMention } from "@/types";\n'
        if 'HotelWithPrice' not in content or 'GuestMention' not in content:
            # Just put it after the first import or at the top
            content = import_stmt + content
            
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
            
    # Fix ScoreCard.tsx syntax error: hotel: HotelWithPrice, GuestMention -> hotel: HotelWithPrice
    sc_path = "components/ui/sentiment/ScoreCard.tsx"
    if os.path.exists(sc_path):
        with open(sc_path, 'r', encoding='utf-8') as f:
            sc = f.read()
        sc = sc.replace("hotel: HotelWithPrice, GuestMention;", "hotel: HotelWithPrice;")
        with open(sc_path, 'w', encoding='utf-8') as f:
            f.write(sc)
            
if __name__ == "__main__":
    fix_ts()
