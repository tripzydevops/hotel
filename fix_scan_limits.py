import os
from supabase import create_client
from dotenv import load_dotenv

def update_scan_limits():
    load_dotenv('/home/tripzydevops/hotel/.env.local')
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    supabase = create_client(url, key)

    # Define standardized scan settings
    # Pro/Enterprise/Trial: Hourly enabled
    # Starter: Hourly disabled
    updates = {
        "trial": {"can_scan_hourly": True, "monthly_scan_limit": 100},
        "starter": {"can_scan_hourly": False, "monthly_scan_limit": 30},
        "pro": {"can_scan_hourly": True, "monthly_scan_limit": 500},
        "enterprise": {"can_scan_hourly": True, "monthly_scan_limit": 9999}
    }

    print("Updating scan limits in membership_plans...")
    
    for plan_name, config in updates.items():
        res = supabase.table('membership_plans').update(config).eq('name', plan_name.capitalize()).execute()
        if res.data:
            print(f"Updated {plan_name.capitalize()}: {config}")
        else:
            # Try lower case just in case
            res = supabase.table('membership_plans').update(config).eq('name', plan_name).execute()
            if res.data:
                print(f"Updated {plan_name}: {config}")
            else:
                print(f"Plan {plan_name} not found for update.")

    print("Database update complete.")

if __name__ == "__main__":
    update_scan_limits()
