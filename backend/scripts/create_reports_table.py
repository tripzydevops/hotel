
import os
from supabase import create_client, Client

def migrate():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Missing Supabase credentials")
        return

    db: Client = create_client(url, key)

    # SQL to create reports table
    sql = """
    create table if not exists reports (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz default now(),
        created_by uuid references auth.users(id),
        report_type text check (report_type in ('single', 'comparison')),
        hotel_ids uuid[],
        period_months int,
        period_start date,
        period_end date,
        report_data jsonb,
        pdf_url text,
        title text
    );
    
    -- Enable RLS
    alter table reports enable row level security;

    -- Create policies (simplified for MVP: authenticated users can read/create)
    create policy "Enable read access for authenticated users" on reports
        for select using (auth.role() = 'authenticated');

    create policy "Enable insert access for authenticated users" on reports
        for insert with check (auth.role() = 'authenticated');
    """

    try:
        # Supabase-py doesn't execute raw SQL easily on the client side without extensions usually.
        # But we can try the rpc call if a simplified 'exec_sql' exists or use pg directly.
        # However, for this environment, we might rely on the user running it in SQL editor 
        # OR better: check if we can use a python driver. 
        # Since we don't have direct PG access usually, we will try to use a specialized endpoint if available 
        # OR just acknowledge we need the user to run it. 
        
        # ACTUALLY: We have 'backend/scripts/fix_admin_settings.py' which used table APIs.
        # We can't run DDL via the JS/Python client easily unless we have a stored procedure `exec_sql`.
        
        # ALTERNATIVE: We can use the 'postgres' library if installed?
        # Let's check imports in backend/main.py
        pass
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    print("Please run the following SQL in your Supabase SQL Editor:")
    print("-" * 50)
    print("""
    create table if not exists reports (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz default now(),
        created_by uuid references auth.users(id),
        report_type text check (report_type in ('single', 'comparison')),
        hotel_ids uuid[],
        period_months int,
        period_start date,
        period_end date,
        report_data jsonb,
        pdf_url text,
        title text
    );
    alter table reports enable row level security;
    create policy "Enable read access for authenticated users" on reports
        for select using (auth.role() = 'authenticated');
    create policy "Enable insert access for authenticated users" on reports
        for insert with check (auth.role() = 'authenticated');
    """)
    print("-" * 50)
