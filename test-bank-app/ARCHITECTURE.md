# Hamduk Bank - System Architecture

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       HAMDUK BANK APP                          │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    AUTHENTICATION FLOW
═══════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────┐
│  1. SIGNUP (POST /auth/sign-up)                                 │
│     Email: user@example.com                                      │
│     Password: ••••••••                                           │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │   Supabase Auth.signUp  │
        │  Creates unconfirmed    │
        │    user in auth.users   │
        └────────────┬────────────┘
                     │
                     │ Sends email with confirmation link
                     │ https://YOUR_DOMAIN/auth/callback?code=XYZ123
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. EMAIL CONFIRMATION (User clicks link in email)              │
│     Browser navigates to:                                        │
│     https://YOUR_DOMAIN/auth/callback?code=XYZ123               │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  exchangeCodeForSession()    │
        │  (converts code to session)  │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  Check onboarding_at field   │
        └────────────┬──────────┬──────┘
                     │          │
          NOT NULL   │          │   NULL (not onboarded)
                     │          │
      ┌──────────────▼──┐   ┌──┴──────────────────┐
      │  /dashboard     │   │  /onboarding        │
      │ (Continue)      │   │ (Complete Profile)  │
      └─────────────────┘   └────────┬────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────┐
                    │ 3. ONBOARDING FORM          │
                    │ • Full Name                 │
                    │ • BVN (Bank Verification)   │
                    │ • Phone Number              │
                    └────────┬────────────────────┘
                             │
                             ▼
                ┌────────────────────────────────┐
                │  Hash BVN & Phone (SHA256)    │
                │  Call TrustLayer API:         │
                │  client.customer.register({   │
                │    external_id: user.id,      │
                │    bvn_hash: hash,            │
                │    phone_hash: hash           │
                │  })                           │
                └────────┬─────────────────────┘
                         │
                         ▼
                ┌────────────────────────────────┐
                │  Update profiles table:        │
                │  • onboarded_at = NOW()        │
                │  • full_name = Name            │
                │  • bvn_hash = hash             │
                │  • phone_hash = hash           │
                │  • external_id = user.id       │
                └────────┬─────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  /dashboard  │
                  │  (READY!)    │
                  └──────────────┘

═══════════════════════════════════════════════════════════════════
                    TRANSACTION FLOW
═══════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────┐
│  User Initiates Transfer/Airtime                               │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ TrustLayer Pre-Check:    │
        │                          │
        │ POST /api/trustlayer/    │
        │ check-transaction        │
        │                          │
        │ Calls:                   │
        │ client.transaction       │
        │  .analyze({              │
        │   customer_id: user.id,  │
        │   amount: 5000,          │
        │   currency: 'NGN',       │
        │   merchant: recipient,   │
        │   channel: 'transfer'    │
        │  })                      │
        └────┬─────────┬─────────┬─┘
             │         │         │
    low risk │         │ medium  │ high risk
             │         │ risk    │
      ┌──────▼──┐  ┌───▼───┐ ┌──▼────────┐
      │ APPROVE │  │ WARN  │ │ BLOCK    │
      │ Execute │  │ Show  │ │ Reject   │
      │         │  │ Warning│ │          │
      └────┬────┘  └───┬───┘ └─────────┘
           │           │
           │      User Can Override
           │      "Proceed Anyway"
           │           │
           ▼           ▼
      ┌──────────────────────────┐
      │  Execute Transaction:    │
      │  Transfer funds OR       │
      │  Purchase airtime        │
      └──────┬───────────────────┘
             │
             ▼
      ┌──────────────────────────┐
      │  Log to transactions     │
      │  table                   │
      └──────┬───────────────────┘
             │
             │ TrustLayer Webhook
             │ (async)
             │
             ▼
      ┌──────────────────────────┐
      │  POST /api/webhooks/     │
      │  trustlayer              │
      │                          │
      │  Receives:               │
      │  • transaction.checked   │
      │  • customer.risk_updated │
      │  • customer.credit_scored│
      │                          │
      │  Verifies HMAC signature │
      │  Updates profiles table  │
      │  Logs to webhook_logs    │
      └──────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    API ARCHITECTURE
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                             │
│  (app/auth, app/dashboard, app/api, components)                 │
└──────────────┬──────────────────────────────────────┬───────────┘
               │                                      │
        ┌──────▼──────────┐                 ┌────────▼────────┐
        │  Supabase API   │                 │ TrustLayer SDK  │
        │                 │                 │                 │
        │ • Auth         │                 │ • customer      │
        │ • Database     │                 │ • transaction   │
        │ • RLS Policies │                 │ • credit        │
        │                 │                 │ • assistant     │
        │ lib/supabase/   │                 │                 │
        │ • client.ts    │                 │ lib/trustlayer/ │
        │ • server.ts    │                 │ • client.ts     │
        │ • proxy.ts     │                 │                 │
        └────────────────┘                 └─────────────────┘
               │                                      │
        ┌──────▼───────────────────────────────────┬─▼──────┐
        │ Environment Variables (Vercel)          │        │
        │                                         │        │
        │ NEXT_PUBLIC_SUPABASE_URL                │        │
        │ NEXT_PUBLIC_SUPABASE_ANON_KEY           │        │
        │ TRUSTLAYER_API_KEY                      │        │
        │ TRUSTLAYER_API_URL                      │        │
        │ TRUSTLAYER_WEBHOOK_SECRET               │        │
        └─────────────────────────────────────────┴────────┘

═══════════════════════════════════════════════════════════════════
                    DATABASE SCHEMA
═══════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRESQL                         │
└────────────────────────────────────────────────────────────────┘

   auth.users (Supabase managed)
   │
   ├─ id (uuid, primary key)
   ├─ email
   ├─ encrypted_password
   └─ email_confirmed_at


   profiles
   │
   ├─ id (uuid, fk→auth.users.id)
   ├─ email
   ├─ full_name
   ├─ account_number
   ├─ balance (default: 50000)
   │
   ├─ role (user/admin)
   ├─ onboarded_at (timestamp)
   ├─ phone_verified (boolean)
   │
   ├─ bvn_hash (sha256)
   ├─ phone_hash (sha256)
   ├─ external_id (user.id)
   │
   ├─ trust_score (from TrustLayer)
   ├─ credit_score (from TrustLayer)
   └─ last_trust_update


   transactions
   │
   ├─ id (uuid)
   ├─ user_id (fk→profiles.id)
   ├─ transaction_type (transfer/airtime)
   ├─ amount
   ├─ recipient_account / phone_number
   ├─ status (success/failed/pending)
   ├─ risk_level (from TrustLayer)
   └─ created_at


   airtime_providers
   │
   ├─ id (uuid)
   ├─ name (MTN, Airtel, etc)
   └─ code


   webhook_logs
   │
   ├─ id (uuid)
   ├─ user_id (fk→profiles.id)
   ├─ event_type
   ├─ request_id
   ├─ payload (json)
   ├─ status (success/error)
   └─ created_at


   credit_inquiries
   │
   ├─ id (uuid)
   ├─ user_id (fk→profiles.id)
   ├─ credit_score
   ├─ credit_limit
   ├─ response_data (json)
   └─ created_at

═══════════════════════════════════════════════════════════════════
                    ADMIN DASHBOARD
═══════════════════════════════════════════════════════════════════

   /admin (RBAC Protected)
   │
   ├─ Users Tab
   │  ├─ List all users
   │  ├─ Toggle admin role
   │  └─ View trust/credit scores
   │
   ├─ Webhook Logs Tab
   │  ├─ View all TrustLayer events
   │  ├─ Filter by type
   │  └─ Check status
   │
   └─ Analytics Tab
      ├─ Total users
      ├─ Total transactions
      ├─ Average trust scores
      └─ Risk distribution

═══════════════════════════════════════════════════════════════════
                    SECURITY LAYER
═══════════════════════════════════════════════════════════════════

   ┌──────────────────────────────────┐
   │    Row Level Security (RLS)      │
   │                                  │
   │ • Users can only see their data  │
   │ • Admins can see all data        │
   │ • Webhook routes bypass RLS      │
   └──────────────────────────────────┘

   ┌──────────────────────────────────┐
   │     Data Hashing                 │
   │                                  │
   │ • BVN → SHA256 (never plain)     │
   │ • Phone → SHA256 (never plain)   │
   │ • Passwords → Supabase (bcrypt)  │
   └──────────────────────────────────┘

   ┌──────────────────────────────────┐
   │  Webhook Verification            │
   │                                  │
   │ • HMAC-SHA256 signature check    │
   │ • Timestamp validation           │
   │ • Event replay prevention        │
   └──────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    DEPLOYMENT FLOW
═══════════════════════════════════════════════════════════════════

   Local Development
          │
          ▼
   pnpm run dev (http://localhost:3000)
          │
   ┌──────┴──────┐
   │  Test Auth  │
   │  Check Logs │
   └──────┬──────┘
          │
          ▼
   Deploy to Vercel
          │
          ▼
   Add Callback URL to Supabase
   (https://YOUR_DOMAIN/auth/callback)
          │
          ▼
   Set Environment Variables
          │
          ▼
   Register Webhook in TrustLayer
   (https://YOUR_DOMAIN/api/webhooks/trustlayer)
          │
          ▼
   Make Yourself Admin (SQL)
          │
          ▼
   Test Complete Flow
          │
          ├─ Sign Up
          ├─ Email Confirmation
          ├─ Onboarding
          ├─ Transfer with TrustLayer check
          ├─ Admin Dashboard
          └─ Check Webhook Logs
          │
          ▼
   🚀 LIVE IN PRODUCTION
```

## Key Concepts

### External ID
- TrustLayer calls it `customer_id` in transactions
- We pass `user.id` (Supabase UUID) as the external identifier
- Matches them back to profiles table for data lookup

### Risk Levels
- **Low** - Approved immediately
- **Medium** - Show warning, user can override
- **High** - Blocked unless admin override

### Admin Role
- Set in `profiles.role` field
- RBAC middleware checks before allowing admin routes
- Admin can manage users and view all analytics

### Webhook Events
- Async events from TrustLayer
- Update `trust_score` and `credit_score` in profiles
- Logged to `webhook_logs` for audit trail

## Database Relationships

```
auth.users (Supabase)
    ↓ (1:1)
profiles
    ├─ 1:N → transactions
    ├─ 1:N → webhook_logs
    ├─ 1:N → credit_inquiries
    └─ N:1 → airtime_providers
```

All tables use Supabase RLS to ensure users only see their own data.
