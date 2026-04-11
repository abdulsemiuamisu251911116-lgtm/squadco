# Hamduk Bank - Deployment Checklist

## Critical Configuration URLs & Secrets

### 1. Supabase Auth Callback URL ⚠️ REQUIRED

**Add this URL to Supabase immediately after deployment:**

- **Local Development:**
  ```
  http://localhost:3000/auth/callback
  ```

- **Production Vercel:**
  ```
  https://your-project-name.vercel.app/auth/callback
  ```

**Steps:**
1. Go to Supabase Dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add the callback URL to **Redirect URLs**
5. Click **Save**

### 2. Environment Variables to Set

In your Vercel project settings (Settings → Environment Variables), add:

```env
# Supabase (should auto-exist if you used Supabase integration)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# TrustLayer SDK
TRUSTLAYER_API_KEY=your_trustlayer_api_key
TRUSTLAYER_API_URL=https://api.trustlayer.ai

# Webhook Secret (from TrustLayer Dashboard)
TRUSTLAYER_WEBHOOK_SECRET=your_webhook_secret_from_trustlayer
```

### 3. TrustLayer Webhook Configuration

**Webhook URL to register in TrustLayer Dashboard:**

```
https://your-project-name.vercel.app/api/webhooks/trustlayer
```

**Steps in TrustLayer Dashboard:**
1. Go to **Settings** → **Webhooks**
2. Click **Add Webhook**
3. URL: `https://your-project-name.vercel.app/api/webhooks/trustlayer`
4. Select events:
   - `customer.verified`
   - `customer.risk_updated`
   - `customer.credit_scored`
   - `transaction.checked`
5. Set the webhook secret (copy it and add to env vars above)
6. Enable and test

### 4. Admin User Setup

After deployment, make your user an admin:

```sql
-- Run this in Supabase SQL Editor
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'your-user-id';
```

Then you'll see the "Admin Panel" link in the navbar.

## Authentication Flow Verification

After deployment, test the complete flow:

1. **Signup** → `https://your-domain.com/auth/sign-up`
   - Enter email and password
   - Should redirect to `/auth/sign-up-success`

2. **Email Confirmation**
   - Check your email inbox for confirmation link
   - Click the link (should go to `/auth/callback?code=...`)
   - Should automatically redirect to `/onboarding`

3. **Onboarding** → `/onboarding`
   - Enter: Full Name, BVN, Phone Number
   - Click "Complete Onboarding"
   - Should redirect to `/dashboard`

4. **Dashboard** → `/dashboard`
   - See your account balance
   - Access: Overview, Transfer, Receive, Airtime, Profile, Credit, AI Assistant tabs

5. **Admin Access** (if user has admin role)
   - Click "Admin Panel" button in navbar
   - Access admin dashboard with user management and analytics

## API Endpoints Available

### Public Authentication
- `POST /api/auth/create-profile` - Create profile after signup

### Banking Operations (Protected)
- `POST /api/transfer` - Transfer funds
- `POST /api/airtime` - Buy airtime

### TrustLayer APIs (Protected)
- `POST /api/trustlayer/onboard` - Register customer with TrustLayer
- `POST /api/trustlayer/check-transaction` - Analyze transaction risk
- `GET /api/trustlayer/credit-analysis` - Get credit analysis
- `GET /api/trustlayer/profile` - Get customer profile with TrustLayer data
- `POST /api/trustlayer/ai-assistant` - Chat with AI financial assistant

### Admin APIs (Admin Only)
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/users` - List all users with filters
- `GET /api/admin/webhook-logs` - View webhook event logs
- `GET /api/admin/analytics` - Get transaction analytics

### Webhooks
- `POST /api/webhooks/trustlayer` - Receive TrustLayer events (auto-signed)

## Database Tables Created

The following tables are automatically created on first database operation:

- `profiles` - User account data with trust/credit scores
- `transactions` - Transfer and airtime purchase history
- `airtime_providers` - MTN, Airtel, Glo, 9Mobile
- `webhook_logs` - Log of all TrustLayer webhook events
- `credit_inquiries` - History of credit checks

## Security Checklist

- [ ] Supabase callback URL configured
- [ ] All environment variables set in Vercel
- [ ] TrustLayer API key and URL configured
- [ ] Webhook secret configured
- [ ] TrustLayer webhook registered
- [ ] Admin user role set
- [ ] Database RLS policies enabled (auto-created)
- [ ] API routes check authentication on all endpoints
- [ ] BVN and phone numbers are hashed before storage

## Support & Troubleshooting

### Email Not Being Sent?
- Check Supabase SMTP settings
- Verify email address format
- Check spam folder

### Callback Not Working?
- Verify URL in Supabase matches exactly
- Check for trailing slashes
- Ensure domain name is correct

### "Customer not onboarded" Error?
- Complete the onboarding form first
- Check that `onboarded_at` is set in profiles table

### TrustLayer Integration Not Working?
- Verify API key and URL are set
- Check that user has completed onboarding
- Review webhook logs for errors

## Files Added/Modified

Key files for this implementation:

```
lib/trustlayer/
  ├── client.ts (SDK wrapper)
  └── index.ts

app/auth/
  ├── sign-up/page.tsx (modified)
  ├── sign-up-success/page.tsx (new)
  ├── callback/route.ts (modified)

app/onboarding/page.tsx (existing)

app/api/
  ├── trustlayer/
  │   ├── onboard/route.ts
  │   ├── check-transaction/route.ts
  │   ├── credit-analysis/route.ts
  │   ├── profile/route.ts
  │   └── ai-assistant/route.ts
  └── webhooks/trustlayer/route.ts

app/admin/page.tsx (existing)

Documentation:
  ├── AUTH_SETUP.md (this explains callback)
  ├── WEBHOOK_CONFIGURATION.md
  └── DEPLOYMENT_CHECKLIST.md (this file)
```

## Next Steps

1. Deploy to Vercel
2. Copy your deployment URL
3. Add callback URL to Supabase
4. Set all environment variables
5. Register webhook in TrustLayer
6. Test signup → email → callback → onboarding → dashboard flow
7. Promote your user to admin role
8. Access admin panel

That's it! You now have a production-ready AI-powered banking app with TrustLayer fraud detection and credit analysis.
