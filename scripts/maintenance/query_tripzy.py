import sys, os, json
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")
from backend.utils.db import get_supabase_client

db = get_supabase_client(admin=True)
res = db.table('user_profiles').select('user_id, email, role').eq('email', 'tripzydevops@gmail.com').execute()
print("UserProfile for tripzydevops:", res.data)

if res.data:
    uid = res.data[0]['user_id']
    res2 = db.table('user_hotels').select('id, user_id, hotel_id').eq('user_id', uid).execute()
    print("UserHotels for tripzydevops:", res2.data)
else:
    print("No user profile found.")
