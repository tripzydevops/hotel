import asyncio
from backend.utils.db import get_insforge_db, load_env_standard

load_env_standard()
db = get_insforge_db(admin=True)

res = db.table('user_profiles').select('user_id, email').eq('email', 'tripzydevops@gmail.com').execute()
print('profile:', res)

if res.data:
    uid = res.data[0]['user_id']
    res2 = db.table('user_hotels').select('*').eq('user_id', uid).execute()
    print('user_hotels for tripzydevops:', res2)

