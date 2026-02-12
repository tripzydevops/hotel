import sys
import io
import json
from bs4 import BeautifulSoup

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('trivago_debug.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("=== PAGE ANALYSIS ===")
title = soup.find('title')
print(f"Title: {title.get_text() if title else 'No title'}")

# Check __NEXT_DATA__
print("\n=== __NEXT_DATA__ CHECK ===")
next_data_script = soup.find('script', {'id': '__NEXT_DATA__'})
if next_data_script:
    data = json.loads(next_data_script.string)
    
    # Navigate to find hotel data
    props = data.get('props', {}).get('pageProps', {})
    initial = props.get('initialState', {})
    
    # Check all keys in initial state
    print(f"initialState keys: {list(initial.keys())}")
    
    # Check sharedState - often contains lists
    shared = initial.get('sharedState', {})
    if shared:
        print(f"sharedState keys: {list(shared.keys())}")
        
        # Check accommodations or similar
        for key in shared.keys():
            val = shared[key]
            if isinstance(val, list) and len(val) > 0:
                print(f"  {key}: list with {len(val)} items")
                if len(val) > 0:
                    print(f"    First item type: {type(val[0])}")
                    if isinstance(val[0], dict):
                        print(f"    First item keys: {list(val[0].keys())[:10]}")
    
    # Check gqlApi queries more thoroughly
    gql = initial.get('gqlApi', {})
    queries = gql.get('queries', {})
    print(f"\nFound {len(queries)} GraphQL queries")
    for qname, qdata in queries.items():
        print(f"\n  Query: {qname[:80]}...")
        if isinstance(qdata, dict) and 'data' in qdata:
            data_content = qdata['data']
            if isinstance(data_content, dict):
                print(f"    Data keys: {list(data_content.keys())}")
                # Look for accommodation data
                for k, v in data_content.items():
                    if isinstance(v, dict) and 'items' in v:
                        print(f"    Found 'items' in {k}: {len(v['items'])} items")
                    elif isinstance(v, list):
                        print(f"    {k} is a list with {len(v)} items")
else:
    print("No __NEXT_DATA__ found")

# Check for any inline JSON data
print("\n=== INLINE SCRIPTS ===")
scripts = soup.find_all('script')
for i, script in enumerate(scripts):
    if script.string:
        text = script.string
        # Look for hotel-related data
        if 'accommodation' in text.lower() or 'hotelname' in text.lower():
            print(f"Script {i} contains hotel data!")
            print(text[:500])
