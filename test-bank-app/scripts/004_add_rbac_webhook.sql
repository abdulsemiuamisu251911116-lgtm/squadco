-- Add role and webhook fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create webhook_logs table for tracking webhook events
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  request_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook_logs
CREATE POLICY "Only admins can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (auth.uid() IN (SELECT id FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE role = 'admin')));

-- Create index for webhook_logs
CREATE INDEX IF NOT EXISTS webhook_logs_user_id_idx ON public.webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS webhook_logs_event_type_idx ON public.webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON public.webhook_logs(created_at DESC);
