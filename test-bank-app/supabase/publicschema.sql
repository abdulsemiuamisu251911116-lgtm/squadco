-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.airtime_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT airtime_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.credit_inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_score integer,
  credit_limit numeric,
  inquiry_date timestamp without time zone DEFAULT now(),
  response_data jsonb,
  CONSTRAINT credit_inquiries_pkey PRIMARY KEY (id),
  CONSTRAINT credit_inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  account_number text NOT NULL DEFAULT "substring"((id)::text, 1, 10) UNIQUE,
  full_name text,
  balance numeric DEFAULT 1000.00,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  bvn_hash text,
  phone_hash text,
  trustlayer_customer_id text UNIQUE,
  trust_score integer DEFAULT 0,
  credit_score integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  onboarding_status text DEFAULT 'pending'::text,
  last_trust_update timestamp without time zone,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text])),
  webhook_secret text,
  onboarded_at timestamp without time zone,
  phone_verified boolean DEFAULT false,
  external_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['transfer_sent'::text, 'transfer_received'::text, 'airtime'::text])),
  amount numeric NOT NULL,
  description text,
  recipient_account text,
  recipient_name text,
  status text DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['completed'::text, 'pending'::text, 'failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.trust_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT trust_logs_pkey PRIMARY KEY (id),
  CONSTRAINT trust_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  request_id text,
  user_id uuid,
  payload jsonb,
  status text,
  error_message text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);