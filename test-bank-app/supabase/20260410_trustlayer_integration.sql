create extension if not exists pgcrypto;

alter table public.profiles
  alter column trust_score set default 500;

create unique index if not exists profiles_external_id_unique_idx
  on public.profiles (external_id)
  where external_id is not null;

create index if not exists profiles_onboarded_at_idx
  on public.profiles (onboarded_at);

create index if not exists transactions_user_created_at_idx
  on public.transactions (user_id, created_at desc);

create index if not exists trust_logs_user_created_at_idx
  on public.trust_logs (user_id, created_at desc);

create index if not exists webhook_logs_event_created_at_idx
  on public.webhook_logs (event_type, created_at desc);

create index if not exists credit_inquiries_user_inquiry_date_idx
  on public.credit_inquiries (user_id, inquiry_date desc);

alter table public.credit_inquiries
  add column if not exists request_id text,
  add column if not exists rating text,
  add column if not exists loan_eligibility text;

create or replace function public.generate_account_number(user_id uuid)
returns text
language sql
immutable
as $$
  select substring(replace(user_id::text, '-', '') from 1 for 10);
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    balance,
    account_number,
    role,
    onboarding_status,
    external_id
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'User'), '@', 1)),
    1000.00,
    public.generate_account_number(new.id),
    'user',
    'pending',
    new.id
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();
