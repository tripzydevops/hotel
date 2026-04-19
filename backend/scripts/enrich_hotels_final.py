import json
import re

def clean_name(name):
    if not name: return ""
    return name.lower().strip()

def load_locations(paths):
    loc_map = {}
    for path in paths:
        try:
            with open(path, 'r') as f:
                content = f.read()
                # Find JSON block
                json_start = content.find('{')
                if json_start != -1:
                    json_text = content[json_start:]
                    # Simple valid JSON extraction attempt
                    try:
                        data = json.loads(json_text)
                    except:
                        # Try to handle cases where there might be text after JSON
                        data = json.loads(json_text[:json_text.rfind('}')+1])
                    
                    for item in data.get('items', []):
                        full_name = item.get('location_name', '')
                        # Handle formats like "Adana,Turkiye"
                        city_name = full_name.split(',')[0]
                        name = clean_name(city_name)
                        loc_map[name] = {
                            'code': item.get('location_code'),
                            'full_name': full_name
                        }
        except Exception as e:
            print(f"Error loading {path}: {e}")
    return loc_map

def load_hotels(path):
    try:
        with open(path, 'r') as f:
            content = f.read()
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return data.get('rows', [])
    except Exception as e:
        print(f"Error loading hotels {path}: {e}")
    return []

def main():
    loc_paths = [
        "/home/tripzydevops/.gemini/antigravity/brain/a0174466-2fcc-46e7-948b-e27edfda7ff8/.system_generated/steps/8581/output.txt",
        "/home/tripzydevops/.gemini/antigravity/brain/a0174466-2fcc-46e7-948b-e27edfda7ff8/.system_generated/steps/8584/output.txt",
        "/home/tripzydevops/.gemini/antigravity/brain/a0174466-2fcc-46e7-948b-e27edfda7ff8/.system_generated/steps/8585/output.txt",
        "/home/tripzydevops/.gemini/antigravity/brain/a0174466-2fcc-46e7-948b-e27edfda7ff8/.system_generated/steps/8586/output.txt"
    ]
    
    loc_map = load_locations(loc_paths)
    hotels = load_hotels("/home/tripzydevops/.gemini/antigravity/brain/a0174466-2fcc-46e7-948b-e27edfda7ff8/.system_generated/steps/8592/output.txt")
    
    updates = []
    
    # Common cities in Turkey for regex matching
    turkish_cities = ["istanbul", "ankara", "izmir", "bursa", "antalya", "edirne", "bodrum", "fethiye", "marmaris", "cappadocia", "kayseri", "trabzon", "samsung", "mersin", "adiyaman", "yalova", "izmit", "rize", "tekirdag", "mardin", "ayvalik", "cesme", "bozcaada", "alacati"]
    
    # Expanded city mapping for final 38
    final_mapping = {
        "karapinar": "karapinar",
        "kizkalesi": "kizkalesi",
        "izmit": "izmit",
        "istanbul": "istanbul",
        "atakoy": "istanbul",
        "savoy": "london",
        "bellagio": "las vegas",
        "cunda": "ayvalik", # Cunda is an island in Ayvalik
        "gure": "edremit",  # Gure is in Edremit
        "edremit": "edremit",
        "oren": "mugla",    # Milas/Oren
        "ayvalik": "ayvalik",
        "uşak": "usak",
        "usak": "usak",
        "cappadocia": "nevsehir"
    }

    for hotel in hotels:
        h_id = hotel['id']
        h_name = clean_name(hotel['name'])
        h_loc = clean_name(hotel['location'] if hotel['location'] else "")
        
        target_city = None
        
        # 0. Check international/direct strings first
        if "london" in h_name or "london" in h_loc: target_city = "london"
        elif "las vegas" in h_name or "las vegas" in h_loc: target_city = "las vegas"
        elif "dubai" in h_name or "dubai" in h_loc: target_city = "dubai"
        
        # 1. Try to find city in final_mapping keywords
        if not target_city:
            for key, city in final_mapping.items():
                if key in h_name or key in h_loc:
                    target_city = city
                    break
        
        # 2. Try to match direct location string if it's like "City, Country"
        if not target_city and "," in h_loc:
            city_part = h_loc.split(",")[0].strip()
            if city_part in loc_map:
                target_city = city_part
        
        # 3. Try to find Turkish cities in the name
        if not target_city:
            for city in turkish_cities:
                if city in h_name:
                    target_city = city
                    break
        
        if target_city and target_city in loc_map:
            res = loc_map[target_city]
            updates.append({
                'id': h_id,
                'location_code': res['code'],
                'resolved_location_name': res['full_name']
            })
        elif target_city == "las vegas":
            # Manual fallback for Las Vegas (US) if not in loc_map yet
            updates.append({
                'id': h_id,
                'location_code': 1021404, # Las Vegas, NV, US
                'resolved_location_name': 'Las Vegas,Nevada,United States'
            })
            
    # Output JSON for use in SQL tool
    print(json.dumps(updates))

if __name__ == "__main__":
    main()
