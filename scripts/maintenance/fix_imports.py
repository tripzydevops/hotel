import os

def force_add_import(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'import { HotelWithPrice, GuestMention } from "@/types"' in content:
        print(f"Already imported in {filepath}")
        return
        
    # Inject it after the first import or "use client"
    if "use client" in content:
        content = content.replace('"use client";\n', '"use client";\nimport { HotelWithPrice, GuestMention } from "@/types";\n')
    else:
        content = 'import { HotelWithPrice, GuestMention } from "@/types";\n' + content
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Added import to {filepath}")

files = [
    "app/(dashboard)/analysis/sentiment/page.tsx",
    "components/ui/sentiment/ScoreCard.tsx"
]

for f in files:
    force_add_import(f)
