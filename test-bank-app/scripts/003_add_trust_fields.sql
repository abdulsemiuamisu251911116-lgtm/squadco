-- Add TrustLayer fields to profiles table
alter table public.profiles add column if not exists bvn_hash text;
alter table public.profiles add column if not exists phone_hash text;
alter table public.profiles add column if not exists trustlayer_customer_id text unique;
alter table public.profiles add column if not exists trust_score integer default 0;
alter table public.profiles add column if not exists credit_score integer default 0;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists onboarding_status text default 'pending'; -- pending, in_progress, completed, failed
alter table public.profiles add column if not exists last_trust_update timestamp;

-- Create trust_logs table to track trust events
create table if not exists public.trust_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- fraud_detected, score_updated, transaction_reviewed, etc
  details jsonb,
  created_at timestamp default now()
);

-- Enable RLS on trust_logs
alter table public.trust_logs enable row level security;

-- Create policies for trust_logs
create policy "users_view_own_trust_logs" on public.trust_logs for select using (auth.uid() = user_id);
create policy "users_insert_trust_logs" on public.trust_logs for insert with check (auth.uid() = user_id);
create policy "service_role_manage_trust_logs" on public.trust_logs for all using (auth.role() = 'service_role');

-- Create credit_inquiries table to track credit checks
create table if not exists public.credit_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_score integer,
  credit_limit decimal(12, 2),
  inquiry_date timestamp default now(),
  response_data jsonb
);

-- Enable RLS on credit_inquiries
alter table public.credit_inquiries enable row level security;

-- Create policies for credit_inquiries
create policy "users_view_own_credit" on public.credit_inquiries for select using (auth.uid() = user_id);
create policy "service_role_manage_credit" on public.credit_inquiries for all using (auth.role() = 'service_role');
