
import os
import asyncio
from supabase import create_client

# Load env from .env file if needed, or assume they are set
from dotenv import load_dotenv
load_dotenv()
load_dotenv(".env.local", override=True)

URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not URL or not KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase = create_client(URL, KEY)

SQL_COMMANDS = [
    """
    CREATE TABLE IF NOT EXISTS admin_settings (
        id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
        maintenance_mode BOOLEAN DEFAULT FALSE,
        signup_enabled BOOLEAN DEFAULT TRUE,
        default_currency TEXT DEFAULT 'USD',
        system_alert_message TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    """
    INSERT INTO admin_settings (id, maintenance_mode, signup_enabled, default_currency)
    VALUES ('00000000-0000-0000-0000-000000000000', FALSE, TRUE, 'USD')
    ON CONFLICT (id) DO NOTHING;
    """,
    """
    ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Service Role Full Access'
        ) THEN
            CREATE POLICY "Service Role Full Access" ON admin_settings
                FOR ALL
                TO service_role
                USING (true)
                WITH CHECK (true);
        END IF;
    END
    $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'Public Read Access'
        ) THEN
            CREATE POLICY "Public Read Access" ON admin_settings
                FOR SELECT
                TO anon, authenticated
                USING (true);
        END IF;
    END
    $$;
    """
]

async def run_migration():
    print("Starting Admin Settings Migration...")
    
    # We can't execute raw SQL easily with the JS/Python client without a stored procedure or special permissions usually.
    # But let's try the 'rpc' method if a generic sql exec function exists, or use the 'pg' library if we had connection string.
    # Since we don't have direct SQL access via client usually, we will rely on the fact that the user might have a `exec_sql` RPC function
    # OR we try to just use the Table API to insert the row, which might be enough if the table exists.
    
    # Check if table exists by trying to select
    try:
        print("Checking if table exists...")
        res = supabase.table("admin_settings").select("*").limit(1).execute()
        print("Table accessesible.")
    except Exception as e:
        print(f"Table access failed: {e}. (This script can't create tables without raw SQL access).")
        print("Please run the SQL commands manually in your Supabase Dashboard SQL Editor.")
        for sql in SQL_COMMANDS:
             print(f"--- \n{sql}\n ---")
        return

    # Try to insert/upsert the default row
    try:
        print("Upserting default row...")
        data = {
            "id": "00000000-0000-0000-0000-000000000000",
            "maintenance_mode": False,
            "signup_enabled": True,
            "default_currency": "USD"
        }
        res = supabase.table("admin_settings").upsert(data).execute()
        print("Default row upserted.")
    except Exception as e:
        print(f"Upsert failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
