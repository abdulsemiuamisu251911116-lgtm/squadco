# Hamduk Bank Authentication & Onboarding Setup

## Email Confirmation Redirect URL

After you verify your email via the confirmation link, you need to add the callback URL to your Supabase project.

### Callback URL Format

```
https://your-deployment-domain.com/auth/callback
```

### Steps to Configure in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. In the **Redirect URLs** section, add:
   ```
   https://your-deployment-domain.com/auth/callback
   ```

### Example for Different Deployments

**For Vercel:**
```
https://your-project.vercel.app/auth/callback
```

**For Local Development:**
```
http://localhost:3000/auth/callback
```

## Authentication Flow

### 1. Sign Up
- User signs up with email and password at `/auth/sign-up`
- Email confirmation link is sent to their inbox

### 2. Email Confirmation
- User clicks the confirmation link in their email
- The link redirects to `/auth/callback` with a code parameter
- The app exchanges the code for a session

### 3. Auto-Redirect to Onboarding
- After email confirmation, the app checks if user has completed onboarding
- **If NOT onboarded:** Redirects to `/onboarding`
- **If already onboarded:** Redirects to `/dashboard`

### 4. Onboarding (First Time Only)
- User completes onboarding form with:
  - Full Name
  - BVN (Bank Verification Number)
  - Phone Number
- Data is hashed and sent to TrustLayer API
- User profile is marked as onboarded in the database

### 5. Dashboard Access
- User can now access `/dashboard` with full banking features

## TrustLayer Integration

The app uses the official TrustLayer SDK: `@hamduktrustlayerai/sdk`

### Environment Variables Required

```env
TRUSTLAYER_API_KEY=your_api_key_here
TRUSTLAYER_API_URL=http://localhost:3000/api
```

Production:

```env
TRUSTLAYER_API_URL=https://trustlayerai.labs.hamduk.com.ng/api
```

### SDK Methods Used

```typescript
// Customer Registration (during onboarding)
client.customer.register({
  external_id: userId,
  bvn_hash: hashedBVN,
  phone_hash: hashedPhone
})

// Transaction Analysis (before transfers/airtime)
client.transaction.analyze({
  customer_id: userId,
  amount: number,
  currency: 'NGN',
  merchant: recipient,
  location: 'Lagos',
  channel: 'web' | 'ussd'
})

// Credit Analysis
client.credit.analyze({
  customer_id: userId,
  data_type: 'credit_profile'
})

// AI Financial Assistant
client.assistant.chat(customerId, message, conversationHistory)
```

## MCP Integration

To connect to your MCP services for additional capabilities:

### Available MCP Services
- **Linear** - Issue tracking and management
- **Notion** - Documentation and knowledge base
- **Sentry** - Error tracking and monitoring
- **PostHog** - Analytics
- **Slack** - Team notifications

### Steps to Add MCP

1. Go to v0 Project Settings
2. Click **Rules** → **Connect MCP Services**
3. Select the services you want to integrate
4. Follow the authentication prompts
5. The SDK will automatically be available in your app

## Security Notes

- BVN and phone numbers are hashed with SHA256 before being stored or sent to TrustLayer
- Never expose the TrustLayer API key to the frontend
- All TrustLayer calls go through your backend API routes
- Admin dashboard is RBAC-protected (only users with `role: 'admin'` can access)
- Webhook signatures from TrustLayer are verified with HMAC-SHA256

## Troubleshooting

### "Customer not onboarded" Error
- Ensure user has completed the onboarding form
- Check that `onboarded_at` field is set in the profiles table

### Email Not Received
- Check spam/junk folder
- Verify the email address is correct
- Resend the confirmation email from the signup page

### Callback Not Redirecting
- Ensure the callback URL is added to Supabase URL Configuration
- Check that the domain matches exactly (no trailing slashes)
- For local development, use `http://localhost:3000/auth/callback`

## Testing the Flow

1. **Sign Up**: Go to `https://your-domain.com/auth/sign-up`
2. **Create Account**: Enter email and password
3. **Check Email**: Look for confirmation email (check spam if needed)
4. **Confirm Email**: Click the link in the email
5. **Complete Onboarding**: Fill in BVN, phone, and name
6. **Access Dashboard**: You're now in the dashboard with full banking features
