import os

def fix_page():
    page_path = "app/(dashboard)/analysis/sentiment/page.tsx"
    if not os.path.exists(page_path):
        return
        
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace price_change_percent with change_percent
    content = content.replace('price_change_percent', 'change_percent')
    
    # Fix hotel.guest_mentions possibly undefined
    content = content.replace('hotel.guest_mentions.filter', '(hotel.guest_mentions || []).filter')
    
    with open(page_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    fix_page()
