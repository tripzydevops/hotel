import asyncio
from backend.utils.db import get_insforge_db, load_env_standard

load_env_standard()
db = get_insforge_db()

res = db.table('user_hotels').select('*').limit(5).execute()
print('user_hotels only:', res)

res2 = db.table('user_hotels').select('*, hotels(id, name)').limit(1).execute()
print('with hotels no alias:', res2)
