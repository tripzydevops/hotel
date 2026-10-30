import os
import re

def fix_types_in_file(filepath):
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements for common map/filter iterators
    replacements = [
        # Competitors and Hotels
        (r'\(c: any\)', r'(c: HotelWithPrice)'),
        (r'\(h: any\)', r'(h: HotelWithPrice)'),
        (r'\(comp: any\)', r'(comp: HotelWithPrice)'),
        (r'\(comp: any, idx: number\)', r'(comp: HotelWithPrice, idx: number)'),
        (r'\(hotel: any\)', r'(hotel: HotelWithPrice)'),
        (r'hotel: any;', r'hotel: HotelWithPrice;'),
        (r'hotel: any,', r'hotel: HotelWithPrice,'),
        (r'\(h: any, i: number\)', r'(h: HotelWithPrice, i: number)'),
        
        # Guest Mentions
        (r'\(m: any\)', r'(m: GuestMention)'),
        (r'\(mention: any, index: number\)', r'(mention: GuestMention, index: number)'),
        (r'let parsedMentions: any\[\]', r'let parsedMentions: GuestMention[]'),
        (r'let rawMentions: any\[\]', r'let rawMentions: GuestMention[]'),
        (r'history: any\[\] = \[\]', r'history: any[] = []'), # keep as any if complex
        
        # Sentiment Breakdowns
        (r'\(s: any\)', r'(s: any)'), # Too generic, leave for now or change to SentimentPillar
        (r'\(item: any\)', r'(item: any)'),
        (r'\(i: any\)', r'(i: any)'),
        
        # Sorts
        (r'\(a: any, b: any\)', r'(a: any, b: any)'),
    ]

    new_content = content
    for pattern, replacement in replacements:
        new_content = re.sub(pattern, replacement, new_content)

    # Make sure imports exist
    if 'HotelWithPrice' not in new_content:
        new_content = new_content.replace('import { Hotel } from', 'import { Hotel, HotelWithPrice, GuestMention } from')
    elif 'GuestMention' not in new_content:
        new_content = new_content.replace('HotelWithPrice', 'HotelWithPrice, GuestMention')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes for {filepath}")

files = [
    r"app/(dashboard)/analysis/sentiment/page.tsx",
    r"components/modals/HotelDetailsModal.tsx",
    r"components/tiles/CompetitorTile.tsx",
    r"components/tiles/TargetHotelTile.tsx",
    r"components/ui/sentiment/ScoreCard.tsx"
]

for f in files:
    fix_types_in_file(f)
