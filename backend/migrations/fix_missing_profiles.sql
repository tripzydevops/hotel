-- 1. Create public.profiles table if it doesn't exist
-- This mirrors the auth.users table for public access
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    updated_at timestamp with time zone,
    email text,
    display_name text,
    company_name text,
    job_title text,
    phone text,
    timezone text default 'UTC',
    -- Membership Fields (from previous task)
    subscription_status text default 'trial',
    plan_type text default 'starter',
    current_period_end timestamp with time zone default (now() + interval '7 days')
);
-- 2. Enable RLS
alter table public.profiles enable row level security;
-- 3. Create policies (if they don't exist)
-- 3. Create policies (Idempotent)
do $$ begin create policy "Public profiles are viewable by everyone." on public.profiles for
select using (true);
exception
when duplicate_object then null;
end $$;
do $$ begin create policy "Users can insert their own profile." on public.profiles for
insert with check (auth.uid() = id);
exception
when duplicate_object then null;
end $$;
do $$ begin create policy "Users can update own profile." on public.profiles for
update using (auth.uid() = id);
exception
when duplicate_object then null;
end $$;
-- 4. Create a trigger to auto-create profile on signup
-- This ensures new users get a profile row immediately
create or replace function public.handle_new_user() returns trigger as $$ begin
insert into public.profiles (id, email)
values (new.id, new.email);
return new;
end;
$$ language plpgsql security definer;
-- Drop trigger if exists to avoid conflicts
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 5.1 Backfill user_profiles (The legacy table used by Admin Panel)
-- Ensure column exists first
do $$ begin
alter table public.user_profiles
add column if not exists email text;
exception
when others then null;
end $$;
insert into public.user_profiles (user_id, email, display_name)
select id,
    email,
    split_part(email, '@', 1)
from auth.users
where id not in (
        select user_id
        from public.user_profiles
    );