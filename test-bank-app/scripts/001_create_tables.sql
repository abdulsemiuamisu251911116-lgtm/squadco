-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  account_number text unique not null generated always as (substring(id::text, 1, 10)) stored,
  full_name text,
  balance decimal(15, 2) default 1000.00,
  phone text,
  created_at timestamp with time zone default now()
);

-- Create transactions table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('transfer_sent', 'transfer_received', 'airtime')),
  amount decimal(15, 2) not null,
  description text,
  recipient_account text,
  recipient_name text,
  status text default 'completed' check (status in ('completed', 'pending', 'failed')),
  created_at timestamp with time zone default now()
);

-- Create airtime_providers table
create table if not exists public.airtime_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  created_at timestamp with time zone default now()
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.airtime_providers enable row level security;

-- RLS Policies for profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_select_by_account" on public.profiles for select using (true);

-- RLS Policies for transactions
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id);

-- RLS Policies for airtime_providers (read-only for users)
create policy "airtime_providers_select" on public.airtime_providers for select using (true);

-- Insert default airtime providers
insert into public.airtime_providers (name, code) values
  ('MTN', 'mtn'),
  ('Airtel', 'airtel'),
  ('Glo', 'glo'),
  ('9Mobile', '9mobile')
on conflict (code) do nothing;

-- Create trigger function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
