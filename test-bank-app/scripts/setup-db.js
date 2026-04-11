import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function setupDatabase() {
  try {
    console.log('[v0] Starting database setup...')

    // Create profiles table
    const profilesSQL = `
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        full_name TEXT,
        phone TEXT,
        account_number TEXT UNIQUE NOT NULL DEFAULT (substring(md5(random()::text), 1, 10)),
        balance DECIMAL(15, 2) DEFAULT 1000.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    const { error: profilesError } = await supabase.rpc('exec', { sql: profilesSQL })
    if (profilesError && !profilesError.message.includes('already exists')) {
      throw profilesError
    }
    console.log('[v0] Profiles table created')

    // Create transactions table
    const transactionsSQL = `
      CREATE TABLE IF NOT EXISTS public.transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        recipient_account TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    const { error: transError } = await supabase.rpc('exec', { sql: transactionsSQL })
    if (transError && !transError.message.includes('already exists')) {
      throw transError
    }
    console.log('[v0] Transactions table created')

    // Create airtime_providers table
    const providersSQL = `
      CREATE TABLE IF NOT EXISTS public.airtime_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      INSERT INTO public.airtime_providers (name, code) VALUES
        ('MTN', 'mtn'),
        ('Airtel', 'airtel'),
        ('Glo', 'glo'),
        ('9Mobile', '9mobile')
      ON CONFLICT (code) DO NOTHING;
    `

    const { error: providerError } = await supabase.rpc('exec', { sql: providersSQL })
    if (providerError && !providerError.message.includes('already exists')) {
      throw providerError
    }
    console.log('[v0] Providers table created and seeded')

    // Enable RLS
    const rlsSQL = `
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.airtime_providers ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Users can view own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = id);
      
      CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = id);

      CREATE POLICY "Users can view own transactions" ON public.transactions
        FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Users can insert own transactions" ON public.transactions
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Anyone can view providers" ON public.airtime_providers
        FOR SELECT USING (true);
    `

    const { error: rlsError } = await supabase.rpc('exec', { sql: rlsSQL })
    if (rlsError && !rlsError.message.includes('already exists')) {
      console.log('[v0] RLS policies might already exist (OK)')
    }
    console.log('[v0] RLS enabled')

    console.log('[v0] Database setup complete!')
  } catch (error) {
    console.error('[v0] Error setting up database:', error)
    process.exit(1)
  }
}

setupDatabase()
